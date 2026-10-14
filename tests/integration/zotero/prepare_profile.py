"""Prepare an empty disposable profile for the real Zotero action-link fixture."""
import argparse
import json
from pathlib import Path
import shutil
import zipfile


def native_path(path):
    value = str(path.resolve())
    if value.startswith('/mnt/') and len(value) > 7 and value[6] == '/':
        return value[5].upper() + ':\\' + value[7:].replace('/', '\\')
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', required=True, type=Path)
    parser.add_argument('--actions-tags-xpi', required=True, type=Path)
    parser.add_argument('--better-notes-xpi', type=Path)
    args = parser.parse_args()
    profile = args.profile.resolve()
    data = profile.with_name(profile.name + '-data')
    if profile.exists() or data.exists():
        parser.error('Profile and sibling data directory must not already exist.')
    root = Path(__file__).resolve().parents[3]
    backup = json.loads((root / 'dist/actions-zotero.json').read_text(encoding='utf-8'))
    keys = ['copySelectionLink', 'copyAnnotationLink', 'copyNoteLink', 'linkBridge']
    actions = {key: backup['actions'][key] for key in keys}
    fixture = 'const trialActions = ' + json.dumps({'actions': actions}) + ';\n'
    fixture += Path(__file__).with_name('linkBridge.fixture.js').read_text(encoding='utf-8')
    actions['trialFixture'] = dict(name='Disposable link fixture', event=8, operation=4,
                                  enabled=True, shortcut='', data=fixture)
    plugins = []
    for source in [args.actions_tags_xpi, args.better_notes_xpi]:
        if source:
            with zipfile.ZipFile(source) as archive:
                manifest = json.loads(archive.read('manifest.json'))
            plugins.append((source, manifest['applications']['zotero']['id']))
    (profile / 'extensions').mkdir(parents=True)
    data.mkdir()
    for source, addon_id in plugins:
        shutil.copyfile(source, profile / 'extensions' / (addon_id + '.xpi'))
    prefs = {
        'extensions.zotero.dataDir': native_path(data),
        'extensions.zotero.useDataDir': True,
        'extensions.zotero.httpServer.enabled': True,
        'extensions.zotero.httpServer.port': 23129,
        'extensions.zotero.firstRunGuidance': False,
        'extensions.zotero.sync.autoSync': False,
        'extensions.autoDisableScopes': 0,
        'extensions.update.enabled': False,
        'extensions.actionsTags.rulesInit': True,
        'extensions.actionsTags.rules': json.dumps(list(actions)),
    }
    prefs.update({'extensions.actionsTags.rules.' + key: json.dumps(action)
                  for key, action in actions.items()})
    (profile / 'user.js').write_text('\n'.join(
        'user_pref(' + json.dumps(key) + ', ' + json.dumps(value) + ');'
        for key, value in prefs.items()) + '\n', encoding='utf-8')
    print('Disposable profile:', native_path(profile))
    print('Report:', profile / 'link-bridge-report.json')


if __name__ == '__main__':
    main()
