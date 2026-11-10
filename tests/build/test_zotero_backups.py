"""Reject unverified backup/environment combinations before starting Zotero."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

import yaml


RUNNER = Path(__file__).resolve().parents[1] / 'integration/zotero/run.py'
spec = importlib.util.spec_from_file_location('zotero_runner', RUNNER)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class ZoteroBackupTests(unittest.TestCase):
    def test_yaml_backup_requires_the_requested_runtime_pair(self):
        expected = {'zotero': '10.0.6', 'actionsTags': '2.6.2'}
        backup = {'type': 'ActionsTagsBackup', 'platformVersion': '10.0.6',
                  'pluginVersion': '2.6.2', 'actions': {'example': {'data': 'return 1;'}}}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'dist').mkdir()

            def write(data):
                (root / 'dist/actions-zotero.yml').write_text(yaml.safe_dump(data), encoding='utf-8')

            write(backup)
            runner.validate_backup(root, expected)
            for field in ['platformVersion', 'pluginVersion']:
                for value in [None, 'different-version']:
                    with self.subTest(field=field, value=value):
                        data = {**backup, field: value}
                        write(data)
                        with self.assertRaisesRegex(SystemExit, 'metadata differs'):
                            runner.validate_backup(root, expected)
