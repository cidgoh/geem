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
    * check if docker container is running
    * docstrings/better commenting
    * replace global variables with getter functions
    * write tests
        * will this work on Mac?
        * will this work on Windows? (Probably not)
    * remove shell=True from check_call
    * better abstract the process of calling commands between clear,
      restore and merge
"""

from argparse import ArgumentParser, ArgumentTypeError
from os.path import abspath, dirname, exists
from os import makedirs
from re import match
from subprocess import CalledProcessError, check_call
from warnings import warn

# TODO: replace global variables with getter functions?
# Directory to place backed up geem_package tables
backup_dir = dirname(dirname(abspath(__file__))) + "/geem_package_backups"
# Template for executing commands in docker database
command_template = 'docker-compose exec -T db psql ' \
                   '--username postgres --dbname postgres ' \
                   '--command "%s"'


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
        # postgres command for copying geem_package table to a tsv file
        copy_command =\
            "\\copy geem_package to stdout delimiter '\t' csv header"
    # User specified packages to backup
    else:
        # String representation of packages, with soft brackets
        packages_string = "(%s)" % ",".join(map(str, packages))
        # postgres command for selecting specified rows
        specified_rows =\
            "(select * from geem_package where id in %s)" % packages_string
        # postgres command for copying specified rows to a tsv file
        copy_command =\
            "\\copy (%s) to stdout delimiter '\t' csv header" % specified_rows

    # Run copy_command in db service docker container
    call(command_template % copy_command
         # Specify .tsv file path for stdout in shell command
         + " > %s/%s" % (backup_dir, file_name))


def delete_packages(packages):
    """TODO: ..."""
    # User did not specify packages to delete
    if packages is None:
        # postgres command to empty geem_package table quickly
        delete_command = "truncate table geem_package"
    # User specified packages to delete
    else:
        # String representation of packages, with soft brackets
        packages_string = "(%s)" % ",".join(map(str, packages))
        # postgres command for deleting specified rows
        delete_command =\
            "delete from geem_package where id in " + packages_string

    # Run delete_command in db service docker container
    call(command_template % delete_command)


def insert_packages(file_name, packages, keep_ids, new_owner_ids):
    """TODO: ..."""
    # Drop temporary table tmp_table from previous, failed inserts
    call(command_template % "drop table if exists tmp_table")
    # Create temporary table tmp_table
    create_command =\
        "create table tmp_table as select * from geem_package with no data"
    call(command_template % create_command)

    try:
        # Populate tmp_table with file_name contents
        copy_command = "\\copy tmp_table from stdin delimiter '\t' csv header"
        call(command_template % copy_command
             # Supply stdin with .tsv file path
             + " < %s/%s" % (backup_dir, file_name))

        # User specified packages to insert
        if packages is not None:
            # String representation of packages, with soft brackets
            packages_string = "(%s)" % ",".join(map(str, packages))
            # postgres command for deleting non-specified rows
            delete_command =\
                "delete from tmp_table where id not in " + packages_string
            # Delete specified rows from tmp_table
            call(command_template % delete_command)

        # The user wants to update the id of packages to be inserted.
        # This guarantees no conflicts will occur, as no package to be
        # inserted will have an id already assigned to an existing
        # package in the local geem_package table.
        if keep_ids is False:
            # geem_package id column sequence name
            geem_package_id_seq = "pg_get_serial_sequence('%s', '%s')"
            geem_package_id_seq = geem_package_id_seq % ("geem_package", "id")
            # This is the postgres command for updating the id's in
            # tmp_table to the next available id's in the local
            # geem_package table.
            update_command = "update tmp_table set id = nextval(%s)"
            update_command = update_command % geem_package_id_seq
            # Update id's in tmp_table
            call(command_template % update_command)

        # User specified new owner_id values for the packages to insert
        if new_owner_ids is not None:
            # Postgres command for setting owner_id's to new_owner_ids
            update_command = "update tmp_table set owner_id = "
            update_command = update_command + str(new_owner_ids)
            # Update owner_id's in tmp_table
            call(command_template % update_command)

        # postgres command for inserting tmp_table into geem_package
        insert_command = "insert into geem_package select * from tmp_table"
        # Insert tmp_table contents into local geem_package table
        call(command_template % insert_command)

        # Drop temporary table
        call(command_template % "drop table tmp_table")
    except CalledProcessError as e:
        warn("Failed to insert data. Table tmp_table was inserted into "
             "database, but not dropped. If you tried to restore data, "
             "packages were removed, but not replaced.")
        raise e


def sync_geem_package_id_seq():
    """TODO: ..."""
    # https://stackoverflow.com/a/3698777
    max_id = "coalesce(MAX(id), 0) + 1"
    geem_package_id_seq = "pg_get_serial_sequence('geem_package', 'id')"
    set_next_val = "select setval(%s, %s, false) from geem_package"
    set_next_val = set_next_val % (geem_package_id_seq, max_id)

    try:
        # Set next value in geem_package_id_seq with above commands
       call(command_template % set_next_val)
    except CalledProcessError as e:
        warn("geem_package_id_seq was not synchronized")
        raise e


def main(args):
    """TODO: ..."""
    # Operation argument
    db_operation = args.db_operation
    # file_name flag (None for "delete")
    file_name = args.file_name
    # packages flag (may be None)
    packages = args.packages
    # keep_ids flag (may be True for "insert"; otherwise False)
    keep_ids = args.keep_ids
    # new_owner_ids flag (may be an int for "insert"; otherwise None)
    new_owner_ids = args.new_owner_ids

    if db_operation == "backup":
        # Backup local geem_package table to file_name
        backup_packages(file_name, packages)
    elif db_operation == "delete":
        # Delete local geem_package table contents
        delete_packages(packages)
    elif db_operation == "insert":
        # Insert file_name contents with local geem_package table
        insert_packages(file_name, packages, keep_ids, new_owner_ids)
    elif db_operation == "restore":
        # We must first delete packages from the local geem_package
        # table that have id's conflicting with the packages to be
        # restored.
        delete_packages(packages)
        # We can then insert the user-specified content in file_name
        # into the local geem_package table. There will be no
        # conflicts, with the id and owner_id of packages to be
        # restored remaining the same.
        insert_packages(file_name, packages, True, None)

    # Sync local geem_package_seq_id to corresponding changes
    sync_geem_package_id_seq()


def valid_args(db_operation, file_name, keep_ids, new_owner_ids):
    """TODO: ..."""
    # If db_operation is delete, file_name should be None
    if db_operation == "delete":
        if file_name is not None:
            raise ValueError("--file_name flag is not used by delete")
    # If db_operation is not delete, file_name should be None
    else:
        if file_name is None:
            raise ValueError("--file_name flag is required")

    # If db_operation is insert or restore, file_name path must exist
    if db_operation == "insert" or db_operation == "restore":
        if not exists(backup_dir + "/" + file_name):
            raise ValueError("Unable to perform %s; %s does not exist"
                             % (db_operation, file_name))

    # If keep_ids is True, db_operation should be insert
    if keep_ids is True:
        if db_operation != "insert":
            raise ValueError("--keep_ids flag is only used by insert")

    # If new_owner_ids is not None, db_operation should be insert
    if new_owner_ids is not None:
        if db_operation != "insert":
            raise ValueError("--new_owner_ids flag is only used by insert")


def valid_owner_id(input):
    # Return "NULL" if no input was specified
    if input == "":
        return "NULL"

    # Parse int (will throw ValueError if input is not an int)
    owner_id = int(input)
    # Make sure owner_id is >= 1
    if owner_id >= 1:
        return owner_id
    else:
        # Invalid owner_id
        raise ValueError()


def valid_tsv_file_name(input):
    """TODO: ..."""
    # We allow users to specify files without the ".tsv" extension, but
    # this line will ensure file_name ends with a ".tsv"
    file_name = input.split(".tsv")[0] + ".tsv"

    # Check if valid file name
    if match(r"^[\w,\s-]+\.[A-Za-z]{3}$", file_name) is not None:
        return file_name
    else:
        e = "Not a valid file name: %s" % file_name
        raise ArgumentTypeError(e)


def set_up_parser(parser):
    """TODO: ..."""
    # Add db_operation argument
    parser.add_argument("db_operation",
                        choices=["backup", "delete", "insert", "restore"],
                        help="Required. Specify action to perform on the "
                             "packages in your local GEEM database.")
    # Add file_name flag
    parser.add_argument("-f", "--file_name",
                        type=valid_tsv_file_name,
                        help="Required for every operation except delete. "
                             "Requires one additional argument.Specify .tsv "
                             "file to perform a backup, insert or restore on.")
    # Add packages flag
    parser.add_argument("-p", "--packages",
                        nargs="+", type=int,
                        help="Optional flag for every operation. Requires 1 "
                             "or more additional arguments.Specify "
                             "space-delimited list of id's for packages to "
                             "perform backup, delete, insert or restore on. "
                             "If this flag is not specified, the action will "
                             "be performed on all packages.")
    # Add keep_ids flag
    parser.add_argument("-k", "--keep_ids",
                        action="store_true",
                        help="Optional flag for insert. No additional "
                             "arguments are needed. When this flag is "
                             "specified, the id's of the inserted packages "
                             "will remain the same, and not be changed to the "
                             "next values in the geem_package id sequence. "
                             "This may result in conflicts, and therefore, an "
                             "unsuccessful insert. Note that restore also "
                             "preserves id's, but automatically deletes "
                             "existing packages to resolve conflicts.")
    # Add new_owner_ids flag
    parser.add_argument("-n", "--new_owner_ids",
                        nargs="?", type=valid_owner_id, const="",
                        help="Optional flag for insert. Requires 0 or 1 "
                             "additional arguments. When this flag is "
                             "specified, the owner_id's of the inserted "
                             "packages will be updated. If no additional "
                             "argument is provided, the new owner_id's will "
                             "be set to NULL. If an argument is provided, the "
                             "new owner_id's will be set to that value.")

    # Change "positional arguments" in help message to "operations"
    parser._positionals.title = "operations"
    # Change "optional arguments" in help message to "flag arguments"
    parser._optionals.title = "flag arguments"

    return parser


if __name__ == "__main__":
    # Parser to handle command line arguments
    parser = ArgumentParser()
    # Set up acceptable command line arguments
    set_up_parser(parser)
    # User-specified sub-arguments
    args = parser.parse_args()
    # We must provide additional validation of args that was
    # unachievable in set_up_parser via native argparse functionality.
    # An error is thrown here if args fails to validate.
    valid_args(args.db_operation, args.file_name, args.keep_ids,
               args.new_owner_ids)

    # TODO: check if docker container is running

    # Entry point into code responsible for geem_package table handling
    main(args)
