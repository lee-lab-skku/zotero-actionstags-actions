"""Validate and package the bundled action-link skill without an agent runtime."""

from pathlib import Path
import re
from urllib.parse import unquote, urlsplit
import zipfile

import yaml


ROOT = Path(__file__).resolve().parent
SKILL_NAME = 'zotero-action-links'


def validate_skill(skill_dir):
    """Return the complete payload only when metadata and local links are valid."""
    skill_dir = Path(skill_dir)
    if skill_dir.is_symlink():
        raise ValueError('The skill directory must not be a symbolic link')
    entry = skill_dir / 'SKILL.md'
    if not entry.is_file():
        raise ValueError('Missing SKILL.md')
    files = []
    for path in sorted(skill_dir.rglob('*')):
        if path.is_symlink():
            raise ValueError(f'Symbolic links cannot be packaged: {path}')
        if path.is_file():
            files.append(path)
        elif not path.is_dir():
            raise ValueError(f'Unsupported payload entry: {path}')

    text = entry.read_text(encoding='utf-8')
    match = re.match(r'\A---\r?\n(.*?)\r?\n---(?:\r?\n|\Z)', text, re.S)
    if not match:
        raise ValueError('SKILL.md requires YAML frontmatter')
    metadata = yaml.safe_load(match.group(1))
    if not isinstance(metadata, dict):
        raise ValueError('Skill metadata must be a mapping')
    name = metadata.get('name')
    if (not isinstance(name, str) or len(name) > 64
            or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', name)
            or name != skill_dir.name):
        raise ValueError('Skill name must match its directory and use lowercase hyphenated words')
    description = metadata.get('description')
    if not isinstance(description, str) or not description.strip():
        raise ValueError('Skill description must be a nonempty string')

    root = skill_dir.resolve()
    for path in files:
        if path.suffix != '.md':
            continue
        # Ignore examples and inline code such as the literal [label](uri).
        markdown = re.sub(r'^```[^\n]*\n.*?^```[^\n]*$', '',
                          path.read_text(encoding='utf-8'), flags=re.M | re.S)
        markdown = re.sub(r'`[^`\n]+`', '', markdown)
        for target in re.findall(r'\[[^\]]*\]\(([^)\s]+)\)', markdown):
            url = urlsplit(target)
            if url.scheme in {'http', 'https', 'mailto'}:
                continue
            if url.scheme or url.netloc:
                raise ValueError(f'Unsupported reference in {path.name}: {target}')
            destination = (path.parent / unquote(url.path)).resolve() if url.path else path
            if not destination.is_relative_to(root) or not destination.is_file():
                raise ValueError(f'Missing or external package reference in {path.name}: {target}')
    return files


def build_skill(skill_dir, output):
    """Package the validated directory with stable paths, timestamps and permissions."""
    skill_dir, output = Path(skill_dir), Path(output)
    files = validate_skill(skill_dir)
    if output.resolve().is_relative_to(skill_dir.resolve()):
        raise ValueError('The archive must be outside the skill directory')
    payload = {f'{skill_dir.name}/{path.relative_to(skill_dir).as_posix()}': path.read_bytes()
               for path in files}
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for name, content in payload.items():
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, content)
    with zipfile.ZipFile(output) as archive:
        if archive.testzip() or archive.namelist() != list(payload):
            raise ValueError('Invalid skill archive contents')
        for name, content in payload.items():
            if archive.read(name) != content:
                raise ValueError(f'Archive content mismatch: {name}')
    return output


if __name__ == '__main__':
    try:
        output = build_skill(ROOT / 'skills' / SKILL_NAME, ROOT / 'dist' / f'{SKILL_NAME}.zip')
    except (ValueError, OSError, yaml.YAMLError) as error:
        raise SystemExit(str(error)) from error
    print(f'Validated and packaged {output.name}')
