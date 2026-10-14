import json
import shutil
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[2]


def updater_source(version, repository, root=ROOT):
    source = (root / 'src/updateActions.js').read_text(encoding='utf-8').strip()
    return source.replace('const INSTALLED_VERSION = null;',
                          'const INSTALLED_VERSION = ' + json.dumps(version) + ';', 1).replace(
        "const SOURCE_REPOSITORY = 'lee-lab-skku/zotero-actionstags-actions';",
        'const SOURCE_REPOSITORY = ' + json.dumps(repository) + ';', 1)


class BuildTests(unittest.TestCase):
    def test_build_from_another_directory_produces_equivalent_backups(self):
        with tempfile.TemporaryDirectory() as directory:
            subprocess.run([sys.executable, str(ROOT / 'build.py')], cwd=directory, check=True)
        yaml_data = yaml.safe_load((ROOT / 'dist/actions-zotero.yml').read_text(encoding='utf-8'))
        json_data = json.loads((ROOT / 'dist/actions-zotero.json').read_text(encoding='utf-8'))
        self.assertEqual(yaml_data, json_data)
        self.assertEqual(yaml_data['type'], 'ActionsTagsBackup')
        self.assertNotIn('releaseVersion', yaml_data['actions']['updateActions'])
        self.assertTrue((ROOT / 'dist/actions-zotero.yml').read_text().startswith('version: '))
        self.assertEqual(yaml_data['repository'], 'lee-lab-skku/zotero-actionstags-actions')
        self.assertNotIn('repository', yaml_data['actions']['updateActions'])
        self.assertTrue({'shareItem', 'retrieveItem'}.isdisjoint(yaml_data['actions']))
        self.assertEqual(set(yaml_data['actions']), {meta.stem for meta in (ROOT / 'meta').glob('*.yml')})
        for key, action in yaml_data['actions'].items():
            self.assertIsInstance(action['event'], int)
            if action['operation'] == 4:
                expected = (ROOT / 'src' / (key + '.js')).read_text(encoding='utf-8').strip()
                if key == 'updateActions':
                    expected = updater_source(yaml_data['version'], yaml_data['repository'])
                self.assertEqual(action['data'], expected)

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
                action = data['actions']['updateActions']
                version = data['version']
                self.assertEqual(data['version'], version)
                self.assertEqual(data['repository'], 'example-lab/custom-actions')
                self.assertNotIn('repository', action)
                self.assertNotIn('releaseVersion', action)
                self.assertEqual(action['data'], updater_source(version, data['repository'], repo))
                return version

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
            source = repo / 'src/updateActions.js'
            source.write_text(source.read_text() + '\n// local edit\n')
            self.assertEqual(build(), version + '-dirty')

    def test_release_build_embeds_version_and_direct_import_uses_it(self):
        for version, repository in [('v3.0.0', 'lee-lab-skku/zotero-actionstags-actions'),
                                    ('v3.0.0-beta.4', 'example-lab/custom-actions')]:
            with self.subTest(version=version), tempfile.TemporaryDirectory() as directory:
                subprocess.run([sys.executable, str(ROOT / 'build.py'), '--version', version,
                                '--repository', repository],
                               cwd=directory, check=True)
                yaml_data = yaml.safe_load((ROOT / 'dist/actions-zotero.yml').read_text(encoding='utf-8'))
                json_data = json.loads((ROOT / 'dist/actions-zotero.json').read_text(encoding='utf-8'))
                self.assertEqual(yaml_data, json_data)
                self.assertNotIn('releaseVersion', json_data['actions']['updateActions'])
                source = json_data['actions']['updateActions']['data']
                self.assertEqual(json_data['version'], version)
                self.assertEqual(json_data['repository'], repository)
                self.assertNotIn('repository', json_data['actions']['updateActions'])
                self.assertEqual(source, updater_source(version, repository))
                # Execute the generated import body, with no record or an obsolete record.
                script = r"""
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { action, version, repository } = JSON.parse(fs.readFileSync(0, 'utf8'));
(async () => {
    // Match A&T's editor save: only standard fields survive, with settings changed.
    const fields = ['event', 'operation', 'data', 'shortcut', 'enabled', 'menu', 'name', 'showInMenu'];
    const saved = Object.fromEntries(fields.filter(key => key in action).map(key => [key, action[key]]));
    saved.enabled = true;
    saved.showInMenu = { ...saved.showInMenu, tools: false };
    for (const record of [undefined, 'v2.6.0']) {
        let requests = 0;
        const Zotero = {
            Prefs: { get: () => record, set: () => assert.fail('No update was applied') },
            ActionsTags: { api: { actionManager: { getActions: key => {
                assert.equal(key, 'updateActions');
                return saved;
            } } } },
            HTTP: { request: async (method, url) => {
                assert.equal(url, `https://api.github.com/repos/${repository}/releases?per_page=100&page=1`);
                assert.equal(++requests, 1, 'Matching imported version must not download actions');
                return { response: [{ tag_name: version, assets: [] }] };
            } },
        };
        await new vm.Script('(async () => {' + saved.data + '\n})()')
            .runInNewContext({ require: key => key === 'Zotero' ? Zotero : { prompt: { select: () => assert.fail('No newer release') } } });
        assert.equal(requests, 1);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
"""
                subprocess.run(['node', '-e', script], input=json.dumps({'action': json_data['actions']['updateActions'], 'version': version, 'repository': repository}),
                               text=True, check=True)


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
        # A&T ActionData uses persisted numeric enums, not YAML booleans;
        # updater validation also requires non-negative integer events and op 0..5.
        file = self.root / 'meta/default0.yml'
        original = yaml.safe_load(file.read_text())
        for field, value in [('event', None), ('event', True), ('event', -1), ('event', 0.5),
                             ('operation', None), ('operation', True), ('operation', -1),
                             ('operation', 6), ('operation', 1.5), ('data', 42)]:
            with self.subTest(field=field, value=value):
                file.write_text(yaml.safe_dump({**original, field: value}))
                result = self.build()
                self.assertNotEqual(result.returncode, 0, f'{field}={value!r} was accepted')
                self.assertIn('Invalid action metadata: default0', result.stderr)

    def test_ambiguous_updater_markers_fail_before_generating_backups(self):
        file = self.root / 'src/updateActions.js'
        original = file.read_text()
        marker = 'const INSTALLED_VERSION = null;'
        for source in [original.replace(marker, ''), original + '\n' + marker]:
            with self.subTest(source_length=len(source)):
                file.write_text(source)
                result = self.build()
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('Missing or ambiguous updater provenance marker', result.stderr)
                self.assertFalse((self.root / 'dist/actions-zotero.json').exists())


if __name__ == '__main__':
    unittest.main()
