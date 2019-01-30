#!/usr/bin/python

"""...

TODO: complete this
...the docstring of a script (a stand-alone program) should be usable as its
"usage" message, printed when the script is invoked with incorrect or
missing arguments (or perhaps with a "-h" option, for "help"). Such a
docstring should document the script's function and command line syntax,
environment variables, and files. Usage messages can be fairly elaborate
(several screens full) and should be sufficient for a new user to use the
command properly, as well as a complete quick reference to all options and
arguments for the sophisticated user.

TODO:
    * Find better way to get name of docker db container
        * Will it always be geem_db_1? How does it get this name?
    * Find a way to make user information anonymous
        * Is there only user information in auth_users table?
"""

import os
import subprocess
import sys

backup_dir = os.path.dirname(os.getcwd()) + '/database_backups'


def backup_volume(name):
    """TODO: ..."""
    # Make backup directory if one does not exist
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)

    command = "sudo docker run --rm --volumes-from geem_db_1 -v %s:/backup " \
              "postgres:10.1 tar cvf /backup/%s.tar " \
              "/var/lib/postgresql/data/" % (backup_dir, name)
    call(command)


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
    subprocess.call(command.split(" "))


def main(op_0, op_1):
    if op_0 == "backup":
        backup_volume(op_1)
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
