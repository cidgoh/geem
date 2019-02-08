#!/usr/bin/python

"""...

TODO: complete this
...the docstring of a script (a stand-alone program) should be usable
as its "usage" message, printed when the script is invoked with
incorrect or missing arguments (or perhaps with a "-h" option, for
"help"). Such a docstring should document the script's function and
command line syntax, environment variables, and files. Usage messages
can be fairly elaborate (several screens full) and should be sufficient
for a new user to use the command properly, as well as a complete quick
reference to all options and arguments for the sophisticated user.
...assumes you do not have to use sudo with docker
...define geem_package handling

TODO:
    * need to rethink restore
        * user cannot specify which packages in geem_package to restore
            * they must specify which packages from their csv to
              restore
        * we can use upsert instead of deleting rows when restoring
            * user can call clear to clear anything they like
    * allow user to specify subset of packages to handle
        * restore and merge remain
    * csv -> tsv
    * allow user to set owner_id upon merge
    * allow user to merge without duplicates
    * write tests
        * will this work on Mac?
        * will this work on Windows? (Probably not)
"""

import argparse
from os.path import abspath, dirname, exists
from os import makedirs
import re
from subprocess import CalledProcessError, check_call
from warnings import warn

# TODO: replace global variables with getter functions?
# Directory to place backed up geem_package tables
backup_dir = dirname(dirname(abspath(__file__))) + "/geem_package_backups"
# Template for executing commands in docker database
command_template = 'docker-compose exec -T db psql ' \
                   '--username postgres --dbname postgres ' \
                   '--command "%s"'


def get_packages_query(packages):
    """TODO: ..."""
    # No specified packages
    if packages is None:
        # Return reference to entire geem_package table
        return "geem_package"
    # Packages were specified
    else:
        # String representation of packages, with soft brackets
        packages_string = "(%s)" % ",".join(map(str, packages))
        # Return query for geem_package rows with an id in packages
        return "(select * from geem_package where id in %s)" % packages_string


def call(command):
    """TODO: ..."""
    # TODO: find out how to do this without shell=True
    check_call(command, shell=True)


def backup_packages(file_name, packages):
    """TODO: ..."""
    # Make backup directory if one does not exist
    if not exists(backup_dir):
        makedirs(backup_dir)

    # User did not specify packages to backup
    if packages is None:
        # postgres command for copying geem_package table to a csv file
        copy_command = "\\copy geem_package to stdout delimiter ',' csv header"
    # User specified packages to backup
    else:
        # String representation of packages, with soft brackets
        packages_str = "(%s)" % ",".join(map(str, packages))
        # postgres command for selecting specified rows
        rows = "(select * from geem_package where id in %s)" % packages_str
        # postgres command for copying specified rows to a csv file
        copy_command = "\\copy (%s) to stdout delimiter ',' csv header" % rows

    # Run copy_command in db service docker container
    call(command_template % copy_command
         # Specify .csv file path for stdout in shell command
         + " > %s/%s" % (backup_dir, file_name))


def clear_packages(packages):
    """TODO: ..."""
    # User did not specify packages to clear
    if packages is None:
        # postgres command to empty geem_package table quickly
        delete_command = "truncate table geem_package"
    # User specified packages to clear
    else:
        # String representation of packages, with soft brackets
        packages_str = "(%s)" % ",".join(map(str, packages))
        # postgres command for deleting specified rows
        delete_command = "delete from geem_package where id in " + packages_str

    # Run clear_command in db service docker container
    call(command_template % delete_command)


def merge_packages(file_name, packages,
                   update_ids=True, update_owner_ids=True):
    """TODO: ..."""
    # Drop temporary table tmp_table from previous, failed merges
    call(command_template % "drop table if exists tmp_table")
    # Create temporary table tmp_table
    create_command ="create table tmp_table " \
                    "as select * from geem_package with no data"
    call(command_template % create_command)

    try:
        # Populate tmp_table with file_name contents
        copy_command = "\\copy tmp_table from stdin delimiter ',' csv header"
        call(command_template % copy_command
             # Supply stdin with .csv file path
             + " < %s/%s" % (backup_dir, file_name))

        # The user wants to update the id of packages to be merged.
        # This guarantees no conflicts will occur, as no package to be
        # merged will have an id already assigned to an existing
        # package in the local geem_package table.
        if update_ids is True:
            # Alter tmp_table id's to fit geem_package id sequence
            update_command = "update tmp_table " \
                             "set id = nextval('geem_package_id_seq')"
            call(command_template % update_command)

        # User does not wants to preserve owner_id's
        if update_owner_ids is True:
            # Set tmp_table owner_id's to NULL
            call(command_template % "update tmp_table set owner_id = NULL")

        # Insert tmp_table contents into local geem_package table
        insert_command = "insert into geem_package select * from tmp_table"
        call(command_template % insert_command)

        # Drop temporary table
        call(command_template % "drop table tmp_table")
    except CalledProcessError as e:
        warn("Failed to merge data. Table tmp_table was inserted into "
             "database, but not dropped. If you tried to restore data, "
             "packages were removed, but not replaced.")
        raise e


def sync_geem_package_id_seq():
    """TODO: ..."""
    # postgres query for max id value in geem_package
    get_max_id = "SELECT (MAX(id)) FROM geem_package"
    # This is the postgres command to set current value in geem_package_id_seq
    # to the max id value om geem_package_table.
    set_curr_val = "SELECT setval('geem_package_id_seq', (%s))" % get_max_id

    try:
        # Set current value in geem_package_id_seq to max id value
       call(command_template % set_curr_val)
    except CalledProcessError as e:
        warn("geem_package_id_seq was not synchronized")
        raise e


def main(args):
    """TODO: ..."""
    # User-specified db_operation
    db_operation = args.db_operation
    # User-specified file_name (may be None)
    file_name = args.file_name
    # User-specified list of packages (may be None)
    packages = args.packages

    if db_operation == "backup":
        # Backup local geem_package table to file_name
        backup_packages(file_name, packages)
    elif db_operation == "clear":
        # Clear local geem_package table contents
        clear_packages(packages)
    elif db_operation == "merge":
        # Merge file_name contents with local geem_package table
        merge_packages(file_name, packages)
    elif db_operation == "restore":
        # We must first clear packages from the local geem_package
        # table that have id's conflicting with the packages to be
        # restored.
        clear_packages(packages)
        # We can then merge the user-specified content in file_name
        # into the local geem_package table. There will be no
        # conflicts, with the id and owner_id of packages to be
        # restored remaining the same.
        merge_packages(file_name, packages,
                       update_ids=False, update_owner_ids=False)

    # Sync local geem_package_seq_id to corresponding changes
    sync_geem_package_id_seq()


def valid_csv_file_name(input):
    """TODO: ..."""
    # We allow users to specify files without the ".csv" extension, but
    # this line will ensure file_name ends with a ".csv"
    file_name = input.split(".csv")[0] + ".csv"

    # Check if valid file name
    if re.match(r"^[\w,\s-]+\.[A-Za-z]{3}$", file_name) is not None:
        return file_name
    else:
        e = "Not a valid file .csv file name: %s" % file_name
        raise argparse.ArgumentTypeError(e)


def set_up_parser(parser):
    """TODO: ..."""
    # Add db_operation argument
    parser.add_argument("db_operation",
                        choices=["backup", "clear", "merge", "restore"])
    # file_name flag: not used in "clear" db_operation
    parser.add_argument("-f", "--file_name",
                        type=valid_csv_file_name,
                        help="required by backup, merge and restore")
    # packages flag: optional for all db_operation's
    parser.add_argument("-p", "--packages",
                        nargs="+", type=int,
                        help="optional for every db_operation")
    # Change "optional arguments" in help message to "flag arguments"
    parser._optionals.title = "flag arguments"
    return parser


def valid_args(db_operation, file_name):
    """TODO: ..."""
    # If db_operation is clear, file_name should be None
    if db_operation == "clear":
        if file_name is not None:
            raise ValueError("--file_name flag is not used by clear")
    # If db_operation is not clear, file_name should be None
    else:
        if file_name is None:
            raise ValueError("--file_name flag is required")

    # If db_operation is restore or merge, file_name must exist in path
    if db_operation == "restore" or db_operation == "merge":
        if not exists(backup_dir + "/" + file_name):
            raise ValueError("Unable to perform %s; %s does not exist"
                             % (db_operation, file_name))


if __name__ == "__main__":
    # Parser to handle command line arguments
    parser = argparse.ArgumentParser()
    # Set up acceptable command line arguments
    set_up_parser(parser)
    # User-specified sub-arguments
    args = parser.parse_args()
    # We must provide additional validation of args that was
    # unachievable in set_up_parser via native argparse functionality.
    # An error is thrown here if args fails to validate.
    valid_args(args.db_operation, args.file_name)

    # TODO: check if docker container is running

    # Entry point into code responsible for geem_package table handling
    main(args)