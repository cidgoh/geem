#!/usr/bin/python

"""Tests scripts/geem_package_handler."""

import argparse
import io
import subprocess
import unittest
from unittest.mock import patch

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

    def setUp(self):
        # Add test packages
        run_command = "run web python /code/manage.py"
        subprocess.call("docker-compose -f %s %s loaddata test_packages"
                        % (self.test_yml, run_command), shell=True)

    def tearDown(self):
        # Empty geem_package
        tear_down_command = gph.docker_command("truncate table geem_package")
        subprocess.call(tear_down_command, shell=True)

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


class TestArgParser(unittest.TestCase):
    """Test parsing of user-inputted command-line arguments."""

    @classmethod
    def setUpClass(cls):
        # Mimic creation of parser in geem_package_handler
        cls.parser = gph.create_parser()

    @patch("sys.stderr", new_callable=io.StringIO)
    def test_backup(self, mock_stderr):
        with self.assertRaises(SystemExit):
            self.parser.parse_args(["backup"])
        self.assertRegexpMatches(mock_stderr.getvalue(),
                                 r"the following arguments are required: "
                                 r"file_name")
        with self.assertRaises(SystemExit):
            self.parser.parse_args(["backup", "###"])
        self.assertRegexpMatches(mock_stderr.getvalue(),
                                 r"###.tsv is not a valid file name")
        with self.assertRaises(SystemExit):
            self.parser.parse_args(["backup", "a", "-p"])
        self.assertRegexpMatches(mock_stderr.getvalue(),
                                 r"argument -p/--packages: expected at least "
                                 r"one argument")
        with self.assertRaises(SystemExit):
            self.parser.parse_args(["backup", "a", "-p", "a"])
        self.assertRegexpMatches(mock_stderr.getvalue(),
                                 r"argument -p/--packages: invalid int value")

        try:
            self.parser.parse_args(["backup", "a"])
        except:
            self.fail("Unexpected SystemExit")
        try:
            self.parser.parse_args(["backup", "a", "-p", "1"])
        except:
            self.fail("Unexpected SystemExit")
        try:
            self.parser.parse_args(["backup", "a", "-p", "1", "2"])
        except:
            self.fail("Unexpected SystemExit")

        actual_args = self.parser.parse_args(["backup", "a"])
        actual_args = vars(actual_args)
        expected_args = {
            "file_name": "a.tsv",
            "packages": None,
            "func": gph.backup_packages
        }
        self.assertDictEqual(actual_args, expected_args)

        actual_args = self.parser.parse_args(["backup", "a", "-p", "1", "2"])
        actual_args = vars(actual_args)
        expected_args = {
            "file_name": "a.tsv",
            "packages": [1, 2],
            "func": gph.backup_packages
        }
        self.assertDictEqual(actual_args, expected_args)

    @patch("sys.stderr", new_callable=io.StringIO)
    def test_delete(self, mock_stderr):
        with self.assertRaises(SystemExit):
            self.parser.parse_args(["delete", "-p"])
        self.assertRegexpMatches(mock_stderr.getvalue(),
                                 r"argument -p/--packages: expected at least "
                                 r"one argument")
        with self.assertRaises(SystemExit):
            self.parser.parse_args(["delete", "-p", "a"])
        self.assertRegexpMatches(mock_stderr.getvalue(),
                                 r"argument -p/--packages: invalid int value")

        try:
            self.parser.parse_args(["delete"])
        except:
            self.fail("Unexpected SystemExit")
        try:
            self.parser.parse_args(["delete", "-p", "1"])
        except:
            self.fail("Unexpected SystemExit")
        try:
            self.parser.parse_args(["delete", "-p", "1", "2"])
        except:
            self.fail("Unexpected SystemExit")

        actual_args = self.parser.parse_args(["delete"])
        actual_args = vars(actual_args)
        expected_args = {
            "packages": None,
            "func": gph.delete_packages
        }
        self.assertDictEqual(actual_args, expected_args)

        actual_args = self.parser.parse_args(["delete", "-p", "1", "2"])
        actual_args = vars(actual_args)
        expected_args = {
            "packages": [1, 2],
            "func": gph.delete_packages
        }
        self.assertDictEqual(actual_args, expected_args)

    @patch("sys.stderr", new_callable=io.StringIO)
    def test_insert(self, mock_stderr):
        with self.assertRaises(SystemExit):
            self.parser.parse_args(["insert"])
        self.assertRegexpMatches(mock_stderr.getvalue(),
                                 r"the following arguments are required: "
                                 r"file_name")
        with self.assertRaises(SystemExit):
            self.parser.parse_args(["insert", "a", "-k", "b"])
        self.assertRegexpMatches(mock_stderr.getvalue(),
                                 r"unrecognized arguments: b")
        with self.assertRaises(SystemExit):
            self.parser.parse_args(["insert", "a", "-n", "c"])
        self.assertRegexpMatches(mock_stderr.getvalue(),
                                 r"argument -n/--new_owner_ids: must be a "
                                 r"natural number")
        with self.assertRaises(SystemExit):
            self.parser.parse_args(["insert", "a", "-n", "0"])
        self.assertRegexpMatches(mock_stderr.getvalue(),
                                 r"argument -n/--new_owner_ids: must be a "
                                 r"natural number")
        # with self.assertRaises(SystemExit):
        with self.assertRaises(SystemExit):
            self.parser.parse_args(["insert", "a", "-n", "-1"])
        self.assertRegexpMatches(mock_stderr.getvalue(),
                                 r"argument -n/--new_owner_ids: must be a "
                                 r"natural number")
        # with self.assertRaises(SystemExit):
        with self.assertRaises(SystemExit):
            self.parser.parse_args(["insert", "a", "-n", "-10"])
        self.assertRegexpMatches(mock_stderr.getvalue(),
                                 r"argument -n/--new_owner_ids: must be a "
                                 r"natural number")
        with self.assertRaises(SystemExit):
            self.parser.parse_args(["insert", "a", "-p", "a"])
        self.assertRegexpMatches(mock_stderr.getvalue(),
                                 r"argument -p/--packages: invalid int value")

        try:
            self.parser.parse_args(["insert", "a"])
        except:
            self.fail("Unexpected SystemExit")
        try:
            self.parser.parse_args(["insert", "a", "-k"])
        except:
            self.fail("Unexpected SystemExit")
        try:
            self.parser.parse_args(["insert", "a", "-n"])
        except:
            self.fail("Unexpected SystemExit")
        try:
            self.parser.parse_args(["insert", "a", "-n", "1"])
        except:
            self.fail("Unexpected SystemExit")
        try:
            self.parser.parse_args(["insert", "a", "-n", "10"])
        except:
            self.fail("Unexpected SystemExit")
        try:
            self.parser.parse_args(["insert", "a", "-k", "-n", "1"])
        except:
            self.fail("Unexpected SystemExit")
        try:
            self.parser.parse_args(["insert", "a", "-k", "-n", "10"])
        except:
            self.fail("Unexpected SystemExit")

        actual_args = self.parser.parse_args(["insert", "a"])
        actual_args = vars(actual_args)
        expected_args = {
            "file_name": "a.tsv",
            "keep_ids": False,
            "new_owner_ids": None,
            "packages": None,
            "func": gph.insert_packages
        }
        self.assertDictEqual(actual_args, expected_args)

        actual_args = self.parser.parse_args(["insert", "a", "-k"])
        actual_args = vars(actual_args)
        expected_args = {
            "file_name": "a.tsv",
            "keep_ids": True,
            "new_owner_ids": None,
            "packages": None,
            "func": gph.insert_packages
        }
        self.assertDictEqual(actual_args, expected_args)

        actual_args = self.parser.parse_args(["insert", "a", "-n"])
        actual_args = vars(actual_args)
        expected_args = {
            "file_name": "a.tsv",
            "keep_ids": False,
            "new_owner_ids": "null",
            "packages": None,
            "func": gph.insert_packages
        }
        self.assertDictEqual(actual_args, expected_args)

        actual_args = self.parser.parse_args(["insert", "a", "-n", "10"])
        actual_args = vars(actual_args)
        expected_args = {
            "file_name": "a.tsv",
            "keep_ids": False,
            "new_owner_ids": "10",
            "packages": None,
            "func": gph.insert_packages
        }
        self.assertDictEqual(actual_args, expected_args)

        actual_args = self.parser.parse_args(["insert", "a", "-k", "-n"])
        actual_args = vars(actual_args)
        expected_args = {
            "file_name": "a.tsv",
            "keep_ids": True,
            "new_owner_ids": "null",
            "packages": None,
            "func": gph.insert_packages
        }
        self.assertDictEqual(actual_args, expected_args)

        actual_args = self.parser.parse_args(["insert", "a", "-k", "-n", "10"])
        actual_args = vars(actual_args)
        expected_args = {
            "file_name": "a.tsv",
            "keep_ids": True,
            "new_owner_ids": "10",
            "packages": None,
            "func": gph.insert_packages
        }
        self.assertDictEqual(actual_args, expected_args)


if __name__ == '__main__':
    unittest.TestLoader.sortTestMethodsUsing = None
    unittest.main()
