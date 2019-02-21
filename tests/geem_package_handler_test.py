#!/usr/bin/python

"""Tests scripts/geem_package_handler."""

import subprocess
import unittest


class TestPackageHandling(unittest.TestCase):
    """Test backup, delete and insert functionality."""

    @classmethod
    def setUpClass(cls):
        # Relative path to docker-compose.test.yml
        cls.test_yml = "../docker-compose.test.yml"

        # Stop and remove default "db" service
        subprocess.call("docker-compose down", shell=True)

        # Setup test "db" service
        run_command = "run web python /code/manage.py"
        subprocess.call("docker-compose -f %s %s makemigrations --noinput"
                        % (cls.test_yml, run_command), shell=True)
        subprocess.call("docker-compose -f %s %s migrate --noinput"
                        % (cls.test_yml, run_command), shell=True)
        subprocess.call("docker-compose -f %s %s loaddata sys_admin"
                        % (cls.test_yml, run_command), shell=True)

    @classmethod
    def tearDownClass(cls):
        # Stop and remove test "db" service
        subprocess.call("docker-compose -f %s down  --volumes --remove-orphans"
                        % cls.test_yml, shell=True)

    def test_something(self):
        self.assertEqual(True, False)


if __name__ == '__main__':
    unittest.main()
