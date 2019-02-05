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
# Template for executing commands in docker database
command_template = 'docker-compose exec -T db psql ' \
                   '--username postgres --dbname postgres ' \
                   '--command "%s"'


def backup_db(backup_name):
    """TODO: ..."""
    # Make backup directory if one does not exist
    if not exists(backup_dir):
        makedirs(backup_dir)

    call(command_template
         % "\\copy geem_package to stdout delimiter ',' csv header"
         # Supply stdout with .csv file path
         + " > %s/%s" % (backup_dir, backup_name))


def restore_db(backup_name):
    """TODO: ..."""
    # Empty geem_package table
    call(command_template % "truncate table geem_package")

    # Populate geem_package table with backup_name contents
    try:
        call(command_template
             % "\\copy geem_package from stdin delimiter ',' csv header"
             # Supply stdin with .csv file path
             + " < %s/%s" % (backup_dir, backup_name))
    except CalledProcessError as e:
        warn("geem_package was truncated, but not restored.")
        raise e


def setup_database():
    """TODO: ..."""
    command = "sudo docker-compose run web python /code/manage.py %s " \
              "--noinput"
    call(command % "makemigrations")
    call(command % "migrate")


def call(command):
    """TODO: ..."""
    # TODO: should we put command template here?
    # TODO: find out how to do this without shell=True
    check_call(command, shell=True)


def main(op_0, op_1):
    # Manipulate op_1 to ensure proper file name
    backup_name = op_1.split(".csv")[0] + ".csv"

    if op_0 == "backup":
        backup_db(backup_name)
    elif op_0 == "restore":
        if exists(backup_dir + "/" + backup_name):
            restore_db(backup_name)
        else:
            # TODO: better message--match script docstring
            raise ValueError("...%s does not exist" % backup_name)
    else:
        # TODO: better message--match script docstring
        raise ValueError("...unrecognized argument: %s" % op_0)


if __name__ == "__main__":
    if len(argv) != 3:
        # TODO: better message--match script docstring
        raise TypeError("...wrong number of arguments")
    else:
        main(argv[1], argv[2])
