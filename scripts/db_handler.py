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
    * What we are now going to do:
        * docker-compose exec db pg_dump --username postgres --dbname
                         postgres > temp_dump
        * docker-compose exec db psql --username postgres --dbname
                         postgres --command "update auth_user set
                         password='*'"
        * docker-compose exec db pg_dump --username postgres --dbname
                         postgres > actual_dump
        * docker-compose exec db psql --username postgres --dbname
                         postgres --command "drop schema public
                         cascade; create schema public"
        * docker-compose exec -T db psql --username postgres --dbname
                         postgres < temp_dump
"""

import os
import subprocess
import sys

backup_dir = os.path.dirname(os.getcwd()) + '/database_backups'
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


def backup_db(name):
    """TODO: ..."""
    # TODO: save the day in case a call doesn't go through
    # Make backup directory if one does not exist
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)

    # Backup content in db service
    call(dump_command % (backup_dir, "temp_dump"))
    # Change passwords to 0 in db service to "hide" them
    call("docker-compose exec db psql --username postgres --dbname postgres " \
         "--command 'update auth_user set password=0'")
    # Backup content in db service with "hidden" passwords
    call(dump_command % (backup_dir, name))
    # Clear content in db service
    call(clear_command)
    # Restore content from backup containing "unhidden" passwords
    call(restore_command % (backup_dir, "temp_dump"))
    # Remove backup with "unhidden" passwords
    os.remove(backup_dir + "/temp_dump")


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
    subprocess.call(command, shell=True)


def main(op_0, op_1):
    if op_0 == "backup":
        backup_db(op_1)
    elif op_0 == "restore":
        if os.path.isfile(backup_dir + "/" + op_1 + ".tar"):
            restore_volume(op_1)
        else:
            # TODO: better message--match script docstring
            raise ValueError("...%s.tar does not exist" % op_1)
    else:
        # TODO: better message--match script docstring
        raise ValueError("...unrecognized argument: %s" % op_0)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        # TODO: better message--match script docstring
        raise TypeError("...wrong number of arguments")
    else:
        main(sys.argv[1], sys.argv[2])
