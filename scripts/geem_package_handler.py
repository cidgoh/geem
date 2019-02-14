#!/usr/bin/python

"""Move content in and out of your db container's geem_package table.

Assumes the db container is already running.

==================
Command-line usage
==================

-----------------------------------------------------------------------
``backup [...]``
-----------------------------------------------------------------------
Copy geem_package content to a tsv file.

Positional arguments
====================

``file_name``
-------------
tsv file to copy contents to.

Optional arguments
==================

``[-p PACKAGES [PACKAGES ...]]``
--------------------------------
Packages (by id) to copy. *Default: all packages*.

-----------------------------------------------------------------------
``delete [...]``
-----------------------------------------------------------------------
Delete geem_package contents

Optional arguments
==================

``[-p PACKAGES [PACKAGES ...]]``
--------------------------------
Packages (by id) to delete. *Default: all packages*.

-----------------------------------------------------------------------
``insert [...]``
-----------------------------------------------------------------------
Copy content from a tsv file to geem_package

Positional arguments
====================

``file_name``
-------------
tsv file to copy content from

Optional arguments
==================

``-k, --keep_ids``
------------------
Do not change the id of inserted packages to the next values of the
geem_package id column sequence. **Warning: may cause conflicts.**

``-n [NEW_OWNER_IDS], --new_owner_ids [NEW_OWNER_IDS]``
-------------------------------------------------------
Change the owner_id of inserted packages to a specified value.
*Default: null*.

``-p PACKAGES [PACKAGES ...], --packages PACKAGES [PACKAGES ...]``
------------------------------------------------------------------
Packages (by id) to insert. *Default: all packages*.

|

----

|

**TODO:**

* script docstring

* write tests

  * will this work on Mac?
  * will this work on Windows? (Probably not)

* remove shell=True from check_call

  * Then, we can remove this function

* better abstract the process of calling commands between backup,
  insert and delete
"""

from argparse import ArgumentParser, ArgumentTypeError
from os.path import abspath, dirname, exists
from os import makedirs
from re import match
from subprocess import CalledProcessError, check_call
from warnings import warn

def get_backup_dir():
    """Get absolute path to your backup directory.

    Your backup directory is defined by this function, and is where
    calls to backup and insert will move geem_package content for your
    db container.

    :return: Absolute path
    :rtype: str
    """
    # Return a directory in the project root
    return dirname(dirname(abspath(__file__))) + "/geem_package_backups"


def docker_command(command):
    """Format command as needed to run inside your db docker container.

    :param str command: postgres command
    :return: Terminal command
    :rtype: str
    """
    # Template for executing commands inside the db container
    command_template = 'docker-compose exec -T db psql ' \
                       '--username postgres --dbname postgres ' \
                       '--command "%s"'

    return command_template % command


def call(command):
    """Runs command in your terminal.

    :param str command: Terminal command
    """
    # TODO: find out how to do this without shell=True. When we do
    #       this, we can get rid of this function.
    check_call(command, shell=True)


def psqlize_int_list(int_list):
    """Formats int_list as a postgres array.

    `See postgres documentation for what consistutes as an array.
    <https://www.postgresql.org/docs/10/arrays.html#ARRAYS-INPUT>`_

    :param list[int] int_list: List to format
    :return: Formatted list
    :rtype: str
    """
    # Map elements of int_list into strings, and join them into a
    # single comma-delimited string. Enclose the final result in soft
    # brackets, and return.
    return "(%s)" % ",".join(map(str, int_list))


def backup_packages(args):
    """Follow command-line arguments to backup geem_package rows.

    *Command-line arguments*
        file_name
            * str
            * tsv file to copy rows to
        packages
            * list[int] or None
            * Specify rows (by id) to backup

    **Requires the docker-compose db container to be running.**

    **Will create a new file named file_name, or overwrite on that
    already exists.**

    :param argparse.Namespace args: Contains command-line arguments
    :raises CalledProcessError: If a docker command fails to execute
    """
    # Create backup directory if it does not already exist
    if not exists(get_backup_dir()):
        makedirs(get_backup_dir())

    # User did not specify packages to backup
    if args.packages is None:
        # postgres command for copying all rows to a stdout with
        # tab-space delimitation.
        copy_command = "\\copy geem_package to stdout delimiter '\t'"
    # User specified packages to backup
    else:
        # postgres command for selecting the specified rows in
        # geem_package.
        specified_rows = "(select * from geem_package where id in %s)"
        specified_rows = specified_rows % psqlize_int_list(args.packages)
        # postgres command for copying the specified rows to a stdout
        # with tab-space delimitation.
        copy_command = "\\copy (%s) to stdout delimiter '\t'" % specified_rows

    # Suffix required to allow the geem_package header to be copied as
    # well. "csv" will not render a comma-delimited output.
    copy_command = copy_command + " csv header"

    # Call copy_command inside the db container, with a special suffix
    # required to supply the path for stdout.
    call(docker_command(copy_command)
         # Supply stdout with a path to file_name. Creates or
         # overwrites "{args.file_name}.tsv".
         + " > %s/%s" % (get_backup_dir(), args.file_name))


def insert_packages(args):
    """Follow command-line arguments to insert rows into geem_package.

    *Command-line arguments*
        file_name
            * str
            * tsv file to copy rows from for insertion
            * **Must exist as a backup in your backup directory**. See
              get_backup_dir for details.
        packages
            * list[int] or None
            * Specify rows (by id) to insert
        keep_ids
            * bool
            * Specify whether to preserve the id of inserted rows
        new_owner_ids
            * int or None
            * Specify a new owner_id for inserted rows

    **Requires the docker-compose db container to be running.**

    :param argparse.Namespace args: Contains command-line arguments
    :raises CalledProcessError: If a docker command fails to execute
    :raises ValueError: If file_name does not exist as a backup
    """
    # Raise error if file to insert packages from does not exist
    if not exists(get_backup_dir() + "/" + args.file_name):
        error_message = "Unable to perform insert; %s does not exist"
        raise ValueError(error_message % args.file_name)

    # Call the postgres command to drop tmp_table, from inside the
    # db container, if it exists from previous, failed calls to this
    # function.
    call(docker_command("drop table if exists tmp_table"))
    # postgres command for creating a table named "tmp_table" with the
    # same scheme as geem_package.
    create_command = "create table tmp_table " \
                     "as select * from geem_package with no data"
    # Call create_command inside the db container
    call(docker_command(create_command))

    try:
        # postgres command for copying rows from a stdin into tmp_table
        copy_command = "\\copy tmp_table from stdin delimiter '\t' csv header"
        # Call copy_command inside the db container, with a special
        # suffix required to supply the path for stdin.
        call(docker_command(copy_command)
             # Supply stdin with the path to file_name
             + " < %s/%s" % (get_backup_dir(), args.file_name))

        # User specified packages to insert
        if args.packages is not None:
            # Convert packages to a postgres command-friendly list format
            psqlized_packages = psqlize_int_list(args.packages)
            # postgres command to delete rows that were not specified
            # from tmp_table.
            delete_command = "delete from tmp_table where id not in "
            delete_command = delete_command + psqlize_int_list(args.packages)
            # Call delete_command inside the db container
            call(docker_command(delete_command))

        # User does not want to preserve the id of inserted packages
        if args.keep_ids is False:
            # postgres command for retrieving the name assigned to
            # geem_package's id sequence.
            geem_package_id_seq = "pg_get_serial_sequence('%s', '%s')"
            geem_package_id_seq = geem_package_id_seq % ("geem_package", "id")
            # postgres command for updating the id's in tmp_table to
            # the next available id's in geem_package_id_seq.
            update_command = "update tmp_table set id = nextval(%s)"
            update_command = update_command % geem_package_id_seq
            # Call update_command inside the db container
            call(docker_command(update_command))

        # User specified a new owner_id value for inserted packages
        if args.new_owner_ids is not None:
            # postgres command for setting owner_id's to new_owner_ids
            update_command = "update tmp_table set owner_id = "
            update_command = update_command + args.new_owner_ids
            # Call update_command inside the db container
            call(docker_command(update_command))

        # postgres command for copying tmp_table into geem_package
        insert_command = "insert into geem_package select * from tmp_table"
        # Call insert_command inside the db container
        call(docker_command(insert_command))
    except CalledProcessError as e:
        warn("Failed to insert data. Table tmp_table was inserted into "
             "your db container, but not dropped.")
        raise e

    try:
        # Call the postgres command to drop tmp_table, from inside the
        # db container.
        call(docker_command("drop table tmp_table"))
    except CalledProcessError as e:
        warn("Table tmp_table was inserted into your db container, but not "
             "dropped.")
        raise e


def delete_packages(args):
    """Follow command-line arguments to delete rows in geem_package.

    *Command-line arguments*
        packages
            * list[int] or None
            * Specify rows (by id) to delete

    **Requires the docker-compose db container to be running.**

    :param argparse.Namespace args: Contains command-line arguments
    :raises CalledProcessError: If a docker command fails to execute
    """
    # User did not specify packages to delete
    if args.packages is None:
        # postgres command to delete all rows in geem_package
        delete_command = "truncate table geem_package"
    # User specified packages to delete
    else:
        # Convert packages to a postgres command-friendly list format
        psqlized_packages = psqlize_int_list(args.packages)
        # postgres command to delete specified rows from geem_package
        delete_command = "delete from geem_package where id in "
        delete_command = delete_command + psqlized_packages

    # Call delete_command inside the db container
    call(docker_command(delete_command))


def sync_geem_package_id_seq():
    """Synchronize the sequence of geem_package's id column.

    Sets the current value of the sequence to the maximum value in the
    geem_package id column, by executing a command in the
    docker-compose db container. Useful when the geem_package id
    sequence in no longer synchronized with the table data.

    **Requires the docker-compose db container to be running.**

    :raises CalledProcessError: If a docker command fails to execute
    """
    # Construct the postgres command for synchronizing the geem_package
    # id sequence. `Source. <https://stackoverflow.com/a/3698777>`_
    max_id = "coalesce(MAX(id), 0) + 1"
    geem_package_id_seq = "pg_get_serial_sequence('geem_package', 'id')"
    set_next_val = "select setval(%s, %s, false) from geem_package"
    set_next_val = set_next_val % (geem_package_id_seq, max_id)

    # Call set_next_val inside the db container
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
    new_parser = ArgumentParser(description="Move content in and out of your "
                                            "db container's geem_package "
                                            "table.")
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
                               help="packages (by id) to insert (default: all "
                                    "packages)")
    # Set default argument to be called with "insert" arguments
    insert_parser.set_defaults(func=insert_packages)

    return new_parser


# Entry point into script
if __name__ == "__main__":
    # Create parser for command-line arguments
    parser = create_parser()
    # Parse user-inputted command-line arguments
    arguments = parser.parse_args()
    # Call default function for user-inputted arguments
    arguments.func(arguments)
    try:
        # The sequence of geem_package's id column does not
        # automatically change in response to the changes performed by
        # this script's default functions. So, we must do it manually.
        sync_geem_package_id_seq()
    except CalledProcessError as e:
        warn("geem_package id sequence was not synchronized")
        raise e
