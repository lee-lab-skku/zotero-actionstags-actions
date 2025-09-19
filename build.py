from pathlib import Path
import yaml

dist_dir = Path('dist')
src_dir = Path('src')
meta_dir = Path('meta')
dist_dir.mkdir(exist_ok=True)

datas = {
    'type': 'ActionsTagsBackup',
    'actions': {}
}

metas = meta_dir.glob('*.yml')
for meta in metas:
    action = meta.stem
    src = src_dir / (action + '.js')

    with open(meta, 'r', encoding='utf-8') as f:
        meta_data = yaml.safe_load(f)
    with open(src, 'r', encoding='utf-8') as f:
        src_code = f.read().strip()

    meta_data['data'] = src_code
    datas['actions'][action] = meta_data

with open(dist_dir / 'zotero-actiontag-copylink.yml', 'w', encoding='utf-8') as f:
    yaml.dump(datas, f, allow_unicode=True)