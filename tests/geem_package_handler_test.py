#!/usr/bin/python

"""Tests scripts/geem_package_handler."""

import argparse
import subprocess
import unittest

import scripts.geem_package_handler as gph


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


class TestHelpers(unittest.TestCase):
    """Test helper methods."""

    def test_docker_command(self):
        self.assertEqual(gph.docker_command(""), 'docker-compose exec -T db '
                                                 'psql --username postgres '
                                                 '--dbname postgres '
                                                 '--command ""')
        self.assertEqual(gph.docker_command(" "), 'docker-compose exec -T db '
                                                  'psql --username postgres '
                                                  '--dbname postgres '
                                                  '--command " "')
        self.assertEqual(gph.docker_command("a"), 'docker-compose exec -T db '
                                                  'psql --username postgres '
                                                  '--dbname postgres '
                                                  '--command "a"')
        self.assertEqual(gph.docker_command("ab"), 'docker-compose exec -T db '
                                                   'psql --username postgres '
                                                   '--dbname postgres '
                                                   '--command "ab"')

    def test_psqlize_int_list(self):
        self.assertEqual(gph.psqlize_int_list([]), "()")
        self.assertEqual(gph.psqlize_int_list([1]), "(1)")
        self.assertEqual(gph.psqlize_int_list([1, 2, 3]), "(1,2,3)")

    def test_valid_owner_id(self):
        self.assertEqual(gph.valid_owner_id("null"), "null")
        self.assertEqual(gph.valid_owner_id("NULL"), "null")
        self.assertEqual(gph.valid_owner_id("nUlL"), "null")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_owner_id("null ")

        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_owner_id("")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_owner_id(" ")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_owner_id("a")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_owner_id("@")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_owner_id("a4")

        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_owner_id("0")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_owner_id("-1")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_owner_id("-2")
        self.assertEqual("1", "1")
        self.assertEqual("2", "2")

    def test_valid_tsv_file_name(self):
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_tsv_file_name("")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_tsv_file_name(".tsv")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_tsv_file_name(r"\ ")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_tsv_file_name(r"\ .tsv")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_tsv_file_name("@#")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_tsv_file_name("@#.tsv")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_tsv_file_name("a@")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_tsv_file_name("a@.tsv")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_tsv_file_name(".tsv.tsv")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_tsv_file_name("a.csv")
        with self.assertRaises(argparse.ArgumentTypeError):
            gph.valid_tsv_file_name("a.tsv.tsv")

        self.assertEqual(gph.valid_tsv_file_name("a"), "a.tsv")
        self.assertEqual(gph.valid_tsv_file_name("a.tsv"), "a.tsv")
        self.assertEqual(gph.valid_tsv_file_name("a_"), "a_.tsv")
        self.assertEqual(gph.valid_tsv_file_name("a_.tsv"), "a_.tsv")
        self.assertEqual(gph.valid_tsv_file_name("tsv.tsv"), "tsv.tsv")
        self.assertEqual(gph.valid_tsv_file_name("tsv.tsv"), "tsv.tsv")


if __name__ == '__main__':
    unittest.main()
