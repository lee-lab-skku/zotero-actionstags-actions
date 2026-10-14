import json
import shutil
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[1]


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
            repo = Path(directory)
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


if __name__ == '__main__':
    unittest.main()
