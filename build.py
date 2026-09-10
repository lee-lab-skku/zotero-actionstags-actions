from pathlib import Path
import json
import yaml
from typing import Dict, Any

root_dir = Path(__file__).resolve().parent
dist_dir = root_dir / 'dist'
src_dir = root_dir / 'src'
meta_dir = root_dir / 'meta'
dist_dir.mkdir(exist_ok=True)

datas: Dict[str, Any] = {
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
    elif meta_data.get('operation') == 4:
        raise ValueError(f'Missing script for action: {action}')

    if not isinstance(meta_data.get('event'), int) or not isinstance(meta_data.get('data'), str):
        raise ValueError(f'Invalid action metadata: {action}')

    datas['actions'][action] = meta_data

with open(dist_dir / 'actions-zotero.yml', 'w', encoding='utf-8') as f:
    yaml.dump(datas, f, allow_unicode=True)

# JSON is also valid YAML and lets the updater avoid evaluating a remote parser.
with open(dist_dir / 'actions-zotero.json', 'w', encoding='utf-8') as f:
    json.dump(datas, f, ensure_ascii=False, indent=2)
    f.write('\n')
