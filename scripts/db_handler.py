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
...define database handling

TODO:
    * write tests
    * rename to package handler?
"""

import argparse
from os.path import abspath, dirname, exists
from os import makedirs
import re
from subprocess import CalledProcessError, check_call
from warnings import warn

# Directory to place backed up databases
backup_dir = dirname(dirname(abspath(__file__))) + "/database_backups"


def backup_db(backup_name):
    """TODO: ..."""
    # Make backup directory if one does not exist
    if not exists(backup_dir):
        makedirs(backup_dir)

    call("\\copy geem_package to stdout delimiter ',' csv header",
         # Supply stdout with .csv file path
         " > %s/%s" % (backup_dir, backup_name))


def restore_db(backup_name):
    """TODO: ..."""
    # Empty geem_package table
    call("truncate table geem_package")

    # Populate geem_package table with backup_name contents
    try:
        call("\\copy geem_package from stdin delimiter ',' csv header",
             # Supply stdin with .csv file path
             " < %s/%s" % (backup_dir, backup_name))
    except CalledProcessError as e:
        warn("geem_package was truncated, but geem_package and "
             "geem_package_id_seq were not restored.")
        raise e


def merge_db(backup_name):
    """TODO: ..."""
    # Drop temporary table tmp_table from previous, failed merges
    call("drop table if exists tmp_table")
    # Create temporary table tmp_table
    call("create table tmp_table as select * from geem_package with no data")

    try:
        # Populate tmp_table with backup_name contents
        call("\\copy tmp_table from stdin delimiter ',' csv header",
             # Supply stdin with .csv file path
             " < %s/%s" % (backup_dir, backup_name))
        # Set tmp_table owner_id's to NULL
        call("update tmp_table set owner_id = NULL")
        # Alter tmp_table id's to fit geem_package sequence
        call("update tmp_table set id = nextval('geem_package_id_seq')")
        # Insert tmp_table contents into geem_package
        call("insert into geem_package select * from tmp_table")
        # Drop temporary table
        call("drop table tmp_table")
    except CalledProcessError as e:
        warn("Failed to merge data. Table tmp_table was inserted into "
             "database, but not dropped.")
        raise e


def sync_geem_package_id_seq():
    """TODO: ..."""
    # Query max id value in geem_package
    get_max_id = "SELECT (MAX(id)) FROM geem_package"

    # Set current value in geem_package_id_seq accordingly
    try:
       call("SELECT setval('geem_package_id_seq', (%s))" % get_max_id)
    except CalledProcessError as e:
        warn("geem_package_id_seq was not synchronized")
        raise e


def call(command, suffix=""):
    """TODO: ..."""
    # Template for executing commands in docker database
    command_template = 'docker-compose exec -T db psql ' \
                       '--username postgres --dbname postgres ' \
                       '--command "%s" %s'

    # TODO: find out how to do this without shell=True
    check_call(command_template % (command, suffix), shell=True)


def main(args):
    """TODO: ..."""
    # User-specified db_operation
    db_operation = args.db_operation
    # User-specified file_name
    file_name = args.file_name

    # If db_operation is restore or merge, file_name should exist
    if db_operation != "backup":
        if not exists(backup_dir + "/" + file_name):
            raise ValueError("Unable to perform %s; %s does not exist"
                             % (db_operation, file_name))

    if db_operation == "backup":
        # Backup local geem_package table to file_name
        backup_db(file_name)
    elif db_operation == "restore":
        # Replace local geem_package table with file_name contents
        restore_db(file_name)
    elif db_operation == "merge":
        # Merge file_name contents with local geem_package table
        merge_db(file_name)

    # Sync geem_package_seq_id to corresponding changes
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
    parser.add_argument("db_operation", choices=["backup", "restore", "merge"])
    # Add file_name argument--ensure valid name
    parser.add_argument("file_name", type=valid_csv_file_name)
    parser.add_argument("-t", "--test")
    return parser


if __name__ == "__main__":
    # TODO: check if docker container is running
    # Parser to handle command line arguments
    parser = argparse.ArgumentParser()
    # Set up acceptable command line arguments
    set_up_parser(parser)
    # User-specified arguments
    args = parser.parse_args()
    # Entry point into code for database handling
    main(args)
