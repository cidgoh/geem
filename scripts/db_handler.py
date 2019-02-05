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
from subprocess import check_call
from sys import argv

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

    call('docker-compose exec -T db psql '
         '--username postgres --dbname postgres '
         '--command '
         '"\\copy geem_package to stdout delimiter \',\' csv header" '
         '> %s/%s' % (backup_dir, backup_name))


def restore_volume(name):
    """TODO: ..."""
    # Stop the database container
    call("sudo docker stop geem_db_1")

    command = "sudo docker run --rm --volumes-from geem_db_1 -v %s:/backup " \
              "postgres:10.1 tar xvf /backup/%s.tar" % (backup_dir, name)
    call(command)
    setup_database()


def setup_database():
    """TODO: ..."""
    command = "sudo docker-compose run web python /code/manage.py %s " \
              "--noinput"
    call(command % "makemigrations")
    call(command % "migrate")


def call(command):
    """TODO: ..."""
    # TODO: find out how to do this without shell=True
    check_call(command, shell=True)


def main(op_0, op_1):
    # Manipulate op_1 to ensure proper file name
    backup_name = op_1.split(".csv")[0] + ".csv"

    if op_0 == "backup":
        backup_db(backup_name)
    elif op_0 == "restore":
        if exists(backup_dir + "/" + op_1 + ".tar"):
            restore_volume(op_1)
        else:
            # TODO: better message--match script docstring
            raise ValueError("...%s.tar does not exist" % op_1)
    else:
        # TODO: better message--match script docstring
        raise ValueError("...unrecognized argument: %s" % op_0)


if __name__ == "__main__":
    if len(argv) != 3:
        # TODO: better message--match script docstring
        raise TypeError("...wrong number of arguments")
    else:
        main(argv[1], argv[2])
