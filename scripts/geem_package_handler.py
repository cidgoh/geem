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
...assume docker containers running
...assumes you do not have to use sudo with docker
...define geem_package handling

TODO:
    * docstrings/better commenting
    * replace global variables with getter functions
    * write tests
        * will this work on Mac?
        * will this work on Windows? (Probably not)
    * remove shell=True from check_call
    * better abstract the process of calling commands between backup,
      insert and delete
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


def docker_command(command):
    """TODO:..."""
    # Template for executing commands in docker database
    command_template = 'docker-compose exec -T db psql ' \
                       '--username postgres --dbname postgres ' \
                       '--command "%s"'
    return command_template % command


def call(command):
    """TODO: ..."""
    # TODO: find out how to do this without shell=True. When we do
    #       this, we can get rid of this function.
    check_call(command, shell=True)


def backup_packages(args):
    """TODO: ..."""
    # Make backup directory if one does not exist
    if not exists(backup_dir):
        makedirs(backup_dir)

    # User did not specify packages to backup
    if args.packages is None:
        # postgres command for copying geem_package table to a tsv file
        copy_command =\
            "\\copy geem_package to stdout delimiter '\t' csv header"
    # User specified packages to backup
    else:
        # String representation of packages, with soft brackets
        packages_string = "(%s)" % ",".join(map(str, args.packages))
        # postgres command for selecting specified rows
        specified_rows =\
            "(select * from geem_package where id in %s)" % packages_string
        # postgres command for copying specified rows to a tsv file
        copy_command =\
            "\\copy (%s) to stdout delimiter '\t' csv header" % specified_rows

    # Run copy_command in db service docker container
    call(command_template % copy_command
         # Specify .tsv file path for stdout in shell command
         + " > %s/%s" % (backup_dir, args.file_name))


def insert_packages(args):
    """TODO: ..."""
    # Raise error if file to insert packages from does not exist
    if not exists(backup_dir + "/" + args.file_name):
        error_message = "Unable to perform insert; %s does not exist"
        raise ValueError(error_message % args.file_name)

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
             + " < %s/%s" % (backup_dir, args.file_name))

        # User specified packages to insert
        if args.packages is not None:
            # String representation of packages, with soft brackets
            packages_string = "(%s)" % ",".join(map(str, args.packages))
            # postgres command for deleting non-specified rows
            delete_command =\
                "delete from tmp_table where id not in " + packages_string
            # Delete specified rows from tmp_table
            call(command_template % delete_command)

        # The user wants to update the id of packages to be inserted.
        # This guarantees no conflicts will occur, as no package to be
        # inserted will have an id already assigned to an existing
        # package in the local geem_package table.
        if args.keep_ids is False:
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
        if args.new_owner_ids is not None:
            # Postgres command for setting owner_id's to new_owner_ids
            update_command = "update tmp_table set owner_id = "
            update_command = update_command + args.new_owner_ids
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
             "database, but not dropped.")
        raise e


def delete_packages(args):
    """TODO: ..."""
    # User did not specify packages to delete
    if args.packages is None:
        # postgres command to empty geem_package table quickly
        delete_command = "truncate table geem_package"
    # User specified packages to delete
    else:
        # String representation of packages, with soft brackets
        packages_string = "(%s)" % ",".join(map(str, args.packages))
        # postgres command for deleting specified rows
        delete_command =\
            "delete from geem_package where id in " + packages_string

    # Run delete_command in db service docker container
    call(command_template % delete_command)


def sync_geem_package_id_seq():
    """Synchronize the sequence of geem_package's id column.

    Sets the current value of the sequence to the maximum value in the
    geem_package id column. Requires the docker-compose db container to
    be running.

    Useful when the geem_package id sequence in no longer synchronized
    with the data.
    """
    # Construct the postgres command for synchronizing the geem_package
    # id sequence. `Source. <https://stackoverflow.com/a/3698777>`_
    max_id = "coalesce(MAX(id), 0) + 1"
    geem_package_id_seq = "pg_get_serial_sequence('geem_package', 'id')"
    set_next_val = "select setval(%s, %s, false) from geem_package"
    set_next_val = set_next_val % (geem_package_id_seq, max_id)

    # Call set_next_val in db container
    call(docker_command(set_next_val))


def valid_owner_id(new_owner_ids):
    """Validates new_owner_ids as a null or natural number.

    Does not validate new_owner_ids as a legal value in geem_package,
    as it does not determine whether new_owner_ids corresponds to an id
    in auth_user.

    :param str new_owner_ids: User-inputted new_owner_ids argument
    :return: *potential* owner_id value for geem_package
    :rtype: str
    :raises ArgumentTypeError: If new_owner_ids is not valid
    """
    # Check if new_owner_ids == "null"
    if new_owner_ids == "null":
        # Return validated new_owner_ids
        return new_owner_ids

    # Check if new_owner_ids is an integer by attempting to parse an
    # integer from new_owner_ids.
    try:
        parsed_owner_id = int(new_owner_ids)
    except ValueError:
        raise ArgumentTypeError("must be a natural number")

    # Check if the parsed integer is a natural number
    if parsed_owner_id >= 1:
        # Return validated new_owner_ids
        return new_owner_ids
    else:
        raise ArgumentTypeError("must be a natural number")


def valid_tsv_file_name(file_name):
    """Validates file_name as a legal tsv file name.

    Will not throw an error if a ".tsv" extension is missing, but will
    append a ".tsv" suffix to file_name if necessary.

    :param str file_name: User-inputted file_name argument
    :return: file_name with potentially appended ".tsv" suffix
    :rtype: str
    :raises ArgumentTypeError: If file_name is not valid
    """
    # Add ".tsv" suffix to file_name if needed
    if not file_name.endswith(".tsv"):
        file_name = file_name + ".tsv"

    # Check if file_name is a valid file_name.
    # `Source. <https://stackoverflow.com/a/6768826>`_
    if match(r"^[\w,\s-]+\.[A-Za-z]{3}$", file_name) is not None:
        # Return validated file_name
        return file_name
    else:
        raise ArgumentTypeError(file_name + " is not a valid file name")


def create_parser():
    """Configures command-line parser for this script using argparse.

    Configures accepted arguments, formatting and help messages.

    :return: Configured parser
    :rtype: ArgumentParser
    """
    # Create new parser
    new_parser = ArgumentParser()
    # Add subparser capability to new_parser
    subparsers = new_parser.add_subparsers(help="-h, or --help for details on "
                                                "each argument")

    # Add "backup" subparser
    backup_parser = subparsers.add_parser("backup",
                                          help="copy geem_package content to "
                                               "a tsv file")
    # Add accepted arguments to "backup" subparser
    backup_parser.add_argument("file_name",
                               type=valid_tsv_file_name,
                               help="tsv file to copy contents to")
    backup_parser.add_argument("-p", "--packages",
                               nargs="+", type=int,
                               help="packages (by id) to copy (default: all "
                                    "packages)")
    # Set default function to be called with "backup" arguments
    backup_parser.set_defaults(func=backup_packages)

    # Add "delete" subparser
    delete_parser = subparsers.add_parser("delete",
                                          help="delete geem_package contents")
    # Add accepted arguments to "delete" subparser
    delete_parser.add_argument("-p", "--packages",
                               nargs="+", type=int,
                               help="packages (by id) to delete (default: all "
                                    "packages)")
    # Set default function to be called with "delete" arguments
    delete_parser.set_defaults(func=delete_packages)

    # Add "insert" subparser
    insert_parser = subparsers.add_parser("insert",
                                          help="copy content from a tsv file "
                                               "to geem_package")
    # Add accepted arguments to "insert" subparser
    insert_parser.add_argument("file_name",
                               type=valid_tsv_file_name,
                               help="tsv file to copy content from")
    insert_parser.add_argument("-k", "--keep_ids",
                               action="store_true",
                               help="do not change the id of inserted "
                                    "packages to the next values of the "
                                    "geem_package id column sequence "
                                    "(warning: may cause conflicts)")
    insert_parser.add_argument("-n", "--new_owner_ids",
                               nargs="?", type=valid_owner_id, const="null",
                               help="change the owner_id of inserted packages "
                                    "to a specified value (default: null)")
    insert_parser.add_argument("-p", "--packages",
                               nargs="+", type=int,
                               help="packaged (by id) to insert (default: all "
                                    "packages)")
    # Set default argument to be called with "insert" arguments
    insert_parser.set_defaults(func=insert_packages)

    return new_parser


# Entry point into script
if __name__ == "__main__":
    # Create parser for command-line arguments
    parser = create_parser()
    # Parse user-inputted command-line arguments
    args = parser.parse_args()
    # Call default function for user-inputted args
    args.func(args)
    try:
        # The sequence of geem_package's id column does not
        # automatically change in response to the changes performed by
        # this script's default functions. So, we must do it manually.
        sync_geem_package_id_seq()
    except CalledProcessError as e:
        warn("geem_package id sequence was not synchronized")
        raise e
