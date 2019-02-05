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

TODO:
    * write tests
    * remove sudo from commands
    * follow new approach: only backup and restore geem_packages
        * docker-compose exec -T db psql
                         --username postgres --dbname postgres
                         --command
                         "\copy geem_package to stdout
                                delimiter ',' csv header"
                         > ../database_backups/test_dump.csv
        * docker-compose exec -T db psql
                         --username postgres --dbname postgres
                         --command
                         "create table tmp_table
                                 as select * from geem_package
                                 with no data"
        * docker-compose exec -T db psql
                         --username postgres --dbname postgres
                         --command
                         "\copy tmp_table from stdin
                                delimiter ',' csv header"
                         < ../database_backups/test_dump.csv
        * docker-compose exec -T db psql
                         --username postgres --dbname postgres
                         --command
                         "update tmp_table set owner_id=1"
        * docker-compose exec -T db psql
                         --username postgres --dbname postgres
                         --command
                         "update tmp_table
                          set id=nextval('geem_package_id_seq')"
        * docker-compose exec -T db psql
                         --username postgres --dbname postgres
                         --command
                         "insert into geem_package
                          select * from tmp_table"
        * docker-compose exec -T db psql
                         --username postgres --dbname postgres
                         --command
                         "drop table tmp_table"
"""

from os.path import abspath, dirname, exists
from os import makedirs
from subprocess import CalledProcessError, check_call
from sys import argv
from warnings import warn

backup_dir = dirname(dirname(abspath(__file__))) + "/database_backups"
# Command to dump data in db service
dump_command = "docker-compose exec db pg_dump " \
               "--username postgres --dbname postgres > %s/%s"
# Restore dumped data back to db service
restore_command = "docker-compose exec -T db psql " \
                  "--username postgres --dbname postgres < %s/%s"
# This command destroys all tables and sequences under the public
# schema in the db service, and should therefore be met with caution.
clear_command = "docker-compose exec db psql " \
                 "--username postgres --dbname postgres " \
                 "--command 'drop schema public cascade;create schema public'"


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
    # Create temporary table
    call("create table tmp_table as select * from geem_package with no data")
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


def sync_geem_package_seq_id():
    """TODO: ..."""
    get_max_id = "SELECT (MAX(id)) FROM geem_package"
    call("SELECT setval('geem_package_id_seq', (%s))" % get_max_id)


def setup_database():
    """TODO: ..."""
    command = "sudo docker-compose run web python /code/manage.py %s " \
              "--noinput"
    call(command % "makemigrations")
    call(command % "migrate")


def call(command, suffix=""):
    """TODO: ..."""
    # Template for executing commands in docker database
    command_template = 'docker-compose exec -T db psql ' \
                       '--username postgres --dbname postgres ' \
                       '--command "%s" %s'

    # TODO: find out how to do this without shell=True
    check_call(command_template % (command, suffix), shell=True)


def main(op_0, op_1):
    # Manipulate op_1 to ensure proper file name
    backup_name = op_1.split(".csv")[0] + ".csv"

    if op_0 == "backup":
        backup_db(backup_name)
    elif op_0 == "restore":
        # TODO: option for restoring some data only
        if exists(backup_dir + "/" + backup_name):
            restore_db(backup_name)
        else:
            # TODO: better message--match script docstring
            raise ValueError("...%s does not exist" % backup_name)
    elif op_0 == "merge":
        # TODO: option for merging some data only
        # TODO: option for excluding duplicates?
        if exists(backup_dir + "/" + backup_name):
            merge_db(backup_name)
        else:
            # TODO: better message--match script docstring
            raise ValueError("...%s does not exist" % backup_name)
    else:
        # TODO: better message--match script docstring
        raise ValueError("...unrecognized argument: %s" % op_0)

    # Sync geem_package_seq_id to corresponding changes
    try:
        sync_geem_package_seq_id()
    except CalledProcessError as e:
        warn("geem_package_id_seq was not synchronized")
        raise e


if __name__ == "__main__":
    if len(argv) != 3:
        # TODO: better message--match script docstring
        raise TypeError("...wrong number of arguments")
    else:
        main(argv[1], argv[2])
