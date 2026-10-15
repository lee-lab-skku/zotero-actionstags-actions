"""Reject unverified backup/environment combinations before starting Zotero."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

import yaml


RUNNER = Path(__file__).resolve().parents[1] / 'integration/zotero/run.py'
spec = importlib.util.spec_from_file_location('zotero_runner', RUNNER)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class ZoteroBackupTests(unittest.TestCase):
    def test_equivalent_backups_require_the_requested_runtime_pair(self):
        expected = {'zotero': '10.0.6', 'actionsTags': '2.6.2'}
        backup = {'type': 'ActionsTagsBackup', 'platformVersion': '10.0.6',
                  'pluginVersion': '2.6.2', 'actions': {'example': {'data': 'return 1;'}}}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'dist').mkdir()

            def write(data, yaml_data=None):
                (root / 'dist/actions-zotero.json').write_text(json.dumps(data))
                (root / 'dist/actions-zotero.yml').write_text(yaml.safe_dump(
                    data if yaml_data is None else yaml_data))

            write(backup)
            runner.validate_backups(root, expected)
            for field in ['platformVersion', 'pluginVersion']:
                for value in [None, 'different-version']:
                    with self.subTest(field=field, value=value):
                        data = {**backup, field: value}
                        write(data)
                        with self.assertRaisesRegex(SystemExit, 'metadata differs'):
                            runner.validate_backups(root, expected)
            write(backup, {**backup, 'actions': {'example': {'data': 'return 2;'}}})
            with self.assertRaisesRegex(SystemExit, 'backups differ'):
                runner.validate_backups(root, expected)
