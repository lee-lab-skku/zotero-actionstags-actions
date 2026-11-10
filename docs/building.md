# Building distributable files

This reference covers backup generation, version and verification metadata, and packaging the bundled agent skill.
See [CONTRIBUTING.md](../CONTRIBUTING.md) for development setup and the contracts these artifacts must preserve.

## Backup generation

`python build.py` combines the three copylink actions and Agent Link Bridge from `src/` and `meta/` into `dist/actions-zotero.yml`.
YAML is the single action backup format for manual imports and integration verification.
Users install and update the actions by importing this backup.
The builder resolves paths relative to the script, so it can run from another working directory.

## Version and source metadata

The backup stores the build identifier in `version` according to these conditions:

| `--version <tag>` supplied | Git state | Recorded version or required action |
| --- | --- | --- |
| Yes | - | Use the supplied tag. |
| No | Clean checkout exactly at a version tag | Use the tag. |
| No | Version tag reachable; later commit or tracked edits | Use `<tag>-<distance>-g<hash>`, adding `-dirty` for tracked edits; distance is zero for edits at the tag. |
| No | Git can derive a commit ID, but no version tag is reachable | Use the commit hash, adding `-dirty` for tracked edits. |
| No | Git cannot derive an ID, including outside a checkout | The build fails; supply `--version` explicitly. |

Git considers tags matching `v[0-9]*` when deriving the build identifier.
The backup's `repository` field identifies the source as follows:

| `--repository <owner/repo>` supplied | Origin | Recorded repository or required action |
| --- | --- | --- |
| Yes | - | Use the supplied `owner/repo`. |
| No | GitHub URL using HTTPS, scp-style SSH, or `ssh://` | Infer `owner/repo` from the URL. |
| No | No origin available | Use `lee-lab-skku/zotero-link-actions`. |
| No | Other origin | The build fails; supply `--repository` explicitly. |

Release CI supplies the tag and `GITHUB_REPOSITORY` automatically.
Both values are top-level backup fields.
These fields identify the backup file; individual actions do not store or manage an installed release version.

## Verification metadata

Every build records a UTC ISO 8601 creation time in the standard backup-root `timestamp`.
Supply `--platform-version <Zotero version> --plugin-version <Actions & Tags version>` together to record the pair being verified in `platformVersion` and `pluginVersion`.
Local builds omit these version fields unless explicitly supplied; supplying them does not establish successful verification.

Release CI requires the actual runtime versions to match the recorded pair before publishing.
The fields describe the checked environment, rather than a compatibility range or coverage of every action and optional plugin.
See [verification scope and artifact handling](../tests/integration/zotero/README.md#ci-verification).

## Agent skill packaging

Run `python build_skill.py` to validate `skills/zot-jot` and create `dist/zot-jot.zip`.
The archive contains a top-level `zot-jot/` directory with `SKILL.md` and its resources, preserving relative paths.

Validation checks the skill name and description, local Markdown document targets, and self-contained resources; missing references and symbolic links are rejected.
Packaging checks archive entries and bytes and uses stable timestamps and permissions so unchanged payloads produce identical archives.
Build tests also extract and validate the standalone skill.
These checks establish package integrity, rather than agent discovery or link generation behavior.

See [distribution contracts](../CONTRIBUTING.md#distribution-contracts) for requirements shared by the backup and skill archive.
