import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[1]


class BuildTests(unittest.TestCase):
    def test_build_from_another_directory_produces_equivalent_backups(self):
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run([sys.executable, str(ROOT / 'build.py')], cwd=directory, check=True)
        yaml_data = yaml.safe_load((ROOT / 'dist/actions-zotero.yml').read_text(encoding='utf-8'))
        json_data = json.loads((ROOT / 'dist/actions-zotero.json').read_text(encoding='utf-8'))
        self.assertEqual(yaml_data, json_data)
        self.assertEqual(yaml_data['type'], 'ActionsTagsBackup')
        self.assertEqual(set(yaml_data['actions']), {meta.stem for meta in (ROOT / 'meta').glob('*.yml')})
        for key, action in yaml_data['actions'].items():
            self.assertIsInstance(action['event'], int)
            if action['operation'] == 4:
                self.assertEqual(action['data'], (ROOT / 'src' / (key + '.js')).read_text(encoding='utf-8').strip())


if __name__ == '__main__':
    unittest.main()
