import json
from datetime import datetime, timezone
import shutil
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[2]
EXPECTED_ACTIONS = {'copySelectionLink', 'copyAnnotationLink', 'copyNoteLink', 'linkBridge'}


class BuildTests(unittest.TestCase):
    def test_build_from_another_directory_produces_equivalent_copylink_backups(self):
        before = datetime.now(timezone.utc)
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run([sys.executable, str(ROOT / 'build.py')], cwd=directory, check=True)
        yaml_data = yaml.safe_load((ROOT / 'dist/actions-zotero.yml').read_text(encoding='utf-8'))
        json_data = json.loads((ROOT / 'dist/actions-zotero.json').read_text(encoding='utf-8'))
        self.assertEqual(yaml_data, json_data)
        self.assertEqual(yaml_data['type'], 'ActionsTagsBackup')
        self.assertEqual(set(yaml_data['actions']), EXPECTED_ACTIONS)
        self.assertTrue(json_data['timestamp'].endswith('Z'))
        generated = datetime.fromisoformat(json_data['timestamp'].replace('Z', '+00:00'))
        self.assertGreaterEqual(generated, before.replace(microsecond=(before.microsecond // 1000) * 1000))
        self.assertLessEqual(generated, datetime.now(timezone.utc))
        self.assertNotIn('platformVersion', json_data)
        self.assertNotIn('pluginVersion', json_data)
        self.assertTrue((ROOT / 'dist/actions-zotero.yml').read_text().startswith('version: '))
        self.assertEqual(yaml_data['repository'], 'lee-lab-skku/zotero-actionstags-actions')
        self.assertEqual(set(yaml_data['actions']), {meta.stem for meta in (ROOT / 'meta').glob('*.yml')})
        for key, action in yaml_data['actions'].items():
            self.assertIsInstance(action['event'], int)
            self.assertEqual(action['operation'], 4)
            self.assertEqual(action['data'], (ROOT / 'src' / (key + '.js')).read_text(encoding='utf-8').strip())

    def test_git_build_id_tracks_exact_tag_distance_and_dirty_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory) / 'repo'
            repo.mkdir()
            shutil.copy(ROOT / 'build.py', repo / 'build.py')
            for name in ['src', 'meta']:
                shutil.copytree(ROOT / name, repo / name)

            def git(*args):
                return subprocess.run(['git', '-c', 'user.name=Build Test',
                                       '-c', 'user.email=build-test@example.invalid', *args],
                                      cwd=repo, check=True, capture_output=True, text=True).stdout.strip()

            def build():
                subprocess.run([sys.executable, str(repo / 'build.py')], check=True, cwd=directory)
                data = json.loads((repo / 'dist/actions-zotero.json').read_text())
                self.assertEqual(data, yaml.safe_load((repo / 'dist/actions-zotero.yml').read_text()))
                self.assertEqual(data['repository'], 'example-lab/custom-actions')
                self.assertEqual(set(data['actions']), EXPECTED_ACTIONS)
                return data['version']

            git('init', '--quiet')
            git('add', '.')
            git('commit', '--quiet', '-m', 'Build fixture',
                '-m', 'Co-authored-by: Codex <codex@openai.com>')
            git('remote', 'add', 'origin', 'git@github.com:example-lab/custom-actions.git')
            git('tag', 'v1.2.3-beta.1')
            self.assertEqual(build(), 'v1.2.3-beta.1')
            for url in ['https://github.com/example-lab/custom-actions.git',
                        'ssh://git@github.com/example-lab/custom-actions.git']:
                git('remote', 'set-url', 'origin', url)
                self.assertEqual(build(), 'v1.2.3-beta.1')
            git('commit', '--quiet', '--allow-empty', '-m', 'Advance fixture',
                '-m', 'Co-authored-by: Codex <codex@openai.com>')
            version = build()
            self.assertRegex(version, r'^v1\.2\.3-beta\.1-1-g[0-9a-f]+$')
            source = repo / 'src/copySelectionLink.js'
            source.write_text(source.read_text() + '\n// local edit\n')
            self.assertEqual(build(), version + '-dirty')

    def test_release_build_records_version_and_repository_in_both_backups(self):
        for version, repository in [('v3.0.0', 'lee-lab-skku/zotero-actionstags-actions'),
                                    ('v3.0.0-beta.4', 'example-lab/custom-actions')]:
            with self.subTest(version=version), tempfile.TemporaryDirectory() as directory:
                subprocess.run([sys.executable, str(ROOT / 'build.py'), '--version', version,
                                '--repository', repository], cwd=directory, check=True)
                yaml_data = yaml.safe_load((ROOT / 'dist/actions-zotero.yml').read_text(encoding='utf-8'))
                json_data = json.loads((ROOT / 'dist/actions-zotero.json').read_text(encoding='utf-8'))
                self.assertEqual(yaml_data, json_data)
                self.assertEqual(json_data['version'], version)
                self.assertEqual(json_data['repository'], repository)
                self.assertEqual(set(json_data['actions']), EXPECTED_ACTIONS)
                for key, action in json_data['actions'].items():
                    self.assertEqual(action['data'], (ROOT / 'src' / (key + '.js')).read_text().strip())


class BuildValidationTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory(prefix='action-build-validation-')
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name) / 'repo'
        self.root.mkdir()
        shutil.copy(ROOT / 'build.py', self.root / 'build.py')
        for name in ['src', 'meta']:
            shutil.copytree(ROOT / name, self.root / name)

    def build(self, *args, explicit_version=True):
        command = [sys.executable, str(self.root / 'build.py')]
        if explicit_version:
            command += ['--version', 'v1.0.0']
        return subprocess.run(command + list(args), cwd=self.root, capture_output=True, text=True)

    def test_invalid_versions_and_repository_paths_fail_before_output(self):
        for option, value in [('--version', ''), ('--version', '  '),
                              ('--repository', '../actions'), ('--repository', 'owner/..'),
                              ('--repository', 'owner/repo/extra'), ('--repository', 'https://github.com/owner/repo')]:
            with self.subTest(option=option, value=value):
                result = self.build(option, value)
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse((self.root / 'dist/actions-zotero.json').exists())

    def test_standard_app_plugin_metadata_is_paired_and_backups_remain_equivalent(self):
        result = self.build('--platform-version', '10.0.6', '--plugin-version', '2.6.2')
        self.assertEqual(result.returncode, 0, result.stderr)
        backup = json.loads((self.root / 'dist/actions-zotero.json').read_text())
        self.assertEqual(backup, yaml.safe_load((self.root / 'dist/actions-zotero.yml').read_text()))
        self.assertEqual(backup['platformVersion'], '10.0.6')
        self.assertEqual(backup['pluginVersion'], '2.6.2')

    def test_incomplete_or_empty_app_plugin_metadata_preserves_existing_backups(self):
        self.assertEqual(self.build().returncode, 0)
        originals = {path: path.read_bytes() for path in (self.root / 'dist').iterdir()}
        for options in [('--platform-version', '10.0.6'), ('--plugin-version', '2.6.2'),
                        ('--platform-version', '', '--plugin-version', '2.6.2'),
                        ('--platform-version', '10.0.6', '--plugin-version', '  ')]:
            with self.subTest(options=options):
                self.assertNotEqual(self.build(*options).returncode, 0)
                for path, content in originals.items():
                    self.assertEqual(path.read_bytes(), content)

    def test_non_git_build_requires_an_explicit_version(self):
        result = self.build(explicit_version=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Cannot derive a Git build ID', result.stderr)
        self.assertEqual(self.build().returncode, 0)

    def test_non_github_origin_requires_explicit_repository(self):
        subprocess.run(['git', 'init', '--quiet'], cwd=self.root, check=True)
        subprocess.run(['git', 'remote', 'add', 'origin', 'https://example.invalid/owner/repo.git'], cwd=self.root, check=True)
        result = self.build()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Cannot infer a GitHub source', result.stderr)
        result = self.build('--repository', 'owner/repo')
        self.assertEqual(result.returncode, 0, result.stderr)
        backup = json.loads((self.root / 'dist/actions-zotero.json').read_text())
        self.assertEqual(backup['repository'], 'owner/repo')

    def test_missing_script_fails_without_replacing_existing_backups(self):
        self.assertEqual(self.build().returncode, 0)
        output = self.root / 'dist/actions-zotero.json'
        previous = output.read_bytes()
        (self.root / 'src/copyNoteLink.js').unlink()
        result = self.build('--version', 'v2.0.0')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Missing script for action: copyNoteLink', result.stderr)
        self.assertEqual(output.read_bytes(), previous)

    def test_action_event_and_operation_must_be_valid_numeric_enum_values(self):
        # Use a metadata-only fixture so source injection cannot mask invalid data.
        file = self.root / 'meta/validation.yml'
        original = {'event': 0, 'operation': 0, 'data': ''}
        for field, value in [('event', None), ('event', True), ('event', -1), ('event', 0.5),
                             ('operation', None), ('operation', True), ('operation', -1),
                             ('operation', 6), ('operation', 1.5), ('data', 42)]:
            with self.subTest(field=field, value=value):
                file.write_text(yaml.safe_dump({**original, field: value}))
                result = self.build()
                self.assertNotEqual(result.returncode, 0, f'{field}={value!r} was accepted')
                self.assertIn('Invalid action metadata: validation', result.stderr)

if __name__ == '__main__':
    unittest.main()
