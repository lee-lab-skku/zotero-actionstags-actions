from pathlib import Path
import argparse
import json
from datetime import datetime, timezone
import re
import subprocess
import yaml
from typing import Dict, Any

parser = argparse.ArgumentParser(description='Build Actions & Tags backups.')
parser.add_argument('--version', help='Explicit release tag; otherwise derive the build ID from Git.')
parser.add_argument('--repository', help='Source GitHub owner/repo; otherwise infer from origin.')
parser.add_argument('--platform-version', help='Zotero version to verify with the generated backups.')
parser.add_argument('--plugin-version', help='Actions & Tags version to verify with the generated backups.')
args = parser.parse_args()
if (args.platform_version is None) != (args.plugin_version is None):
    parser.error('--platform-version and --plugin-version must be provided together')
for value in (args.platform_version, args.plugin_version):
    if value is not None and not value.strip():
        parser.error('App and plugin versions must not be empty')
if args.version is not None and not args.version.strip():
    parser.error('--version must not be empty')

root_dir = Path(__file__).resolve().parent
repository = args.repository
if repository is None:
    try:
        origin = subprocess.run(['git', 'remote', 'get-url', 'origin'], cwd=root_dir,
                                check=True, capture_output=True, text=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        origin = None
    if origin:
        source = re.fullmatch(r'(?:https://github\.com/|git@github\.com:|ssh://git@github\.com/)([^/]+/[^/]+?)(?:\.git)?/?', origin)
        if not source:
            parser.error('Cannot infer a GitHub source from origin; provide --repository explicitly')
        repository = source.group(1)
    else:
        repository = 'lee-lab-skku/zotero-actionstags-actions'
if (not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository)
        or any(part in {'.', '..'} for part in repository.split('/'))):
    parser.error('--repository must be a GitHub owner/repo path')

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
    'repository': repository,
    'type': 'ActionsTagsBackup',
    'timestamp': datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z'),
    'actions': {}
}

if args.platform_version is not None:
    datas['platformVersion'] = args.platform_version
    datas['pluginVersion'] = args.plugin_version

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
    elif meta_data.get('operation') == 4:
        raise ValueError(f'Missing script for action: {action}')

    # Python booleans are ints, but A&T requires numeric enum values.
    event, operation = meta_data.get('event'), meta_data.get('operation')
    if (type(event) is not int or event < 0
            or type(operation) is not int or not 0 <= operation <= 5
            or not isinstance(meta_data.get('data'), str)):
        raise ValueError(f'Invalid action metadata: {action}')

    datas['actions'][action] = meta_data

with open(dist_dir / 'actions-zotero.yml', 'w', encoding='utf-8') as f:
    yaml.dump(datas, f, allow_unicode=True, sort_keys=False)

# Keep a JSON representation with the same action definitions and metadata.
with open(dist_dir / 'actions-zotero.json', 'w', encoding='utf-8') as f:
    json.dump(datas, f, ensure_ascii=False, indent=2)
    f.write('\n')
