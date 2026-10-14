from pathlib import Path
import argparse
import json
import re
import subprocess
import yaml
from typing import Dict, Any

parser = argparse.ArgumentParser(description='Build Actions & Tags backups.')
parser.add_argument('--version', help='Explicit release tag; otherwise derive the build ID from Git.')
args = parser.parse_args()
if args.version is not None and not args.version.strip():
    parser.error('--version must not be empty')

root_dir = Path(__file__).resolve().parent
build_version = args.version
if build_version is None:
    try:
        build_version = subprocess.run(
            ['git', 'describe', '--tags', '--long', '--dirty', '--always', '--match', 'v[0-9]*'],
            cwd=root_dir, check=True, capture_output=True, text=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        parser.error('Cannot derive a Git build ID; provide --version explicitly')
    exact_tag = re.fullmatch(r'(.+)-0-g[0-9a-f]+', build_version)
    if exact_tag:
        build_version = exact_tag.group(1)
dist_dir = root_dir / 'dist'
src_dir = root_dir / 'src'
meta_dir = root_dir / 'meta'
dist_dir.mkdir(exist_ok=True)

datas: Dict[str, Any] = {
    'version': build_version,
    'type': 'ActionsTagsBackup',
    'actions': {}
}

metas = sorted(meta_dir.glob('*.yml'))
for meta in metas:
    action = meta.stem
    src = src_dir / (action + '.js')

    with open(meta, 'r', encoding='utf-8') as f:
        meta_data = yaml.safe_load(f)
    if src.is_file():
        with open(src, 'r', encoding='utf-8') as f:
            src_code = f.read().strip()
        meta_data['data'] = src_code
        if action == 'updateActions':
            meta_data['releaseVersion'] = build_version
    elif meta_data.get('operation') == 4:
        raise ValueError(f'Missing script for action: {action}')

    if not isinstance(meta_data.get('event'), int) or not isinstance(meta_data.get('data'), str):
        raise ValueError(f'Invalid action metadata: {action}')

    datas['actions'][action] = meta_data

with open(dist_dir / 'actions-zotero.yml', 'w', encoding='utf-8') as f:
    yaml.dump(datas, f, allow_unicode=True, sort_keys=False)

# JSON is also valid YAML and lets the updater avoid evaluating a remote parser.
with open(dist_dir / 'actions-zotero.json', 'w', encoding='utf-8') as f:
    json.dump(datas, f, ensure_ascii=False, indent=2)
    f.write('\n')
