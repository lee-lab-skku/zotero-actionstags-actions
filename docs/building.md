# Building distributable files

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development setup and the contracts these artifacts must preserve.

`python build.py` combines `src/` and `meta/` into `dist/actions-zotero.yml` for import and `dist/actions-zotero.json` for updates.
It resolves paths relative to the script, so it can run from another working directory.

## Version and source metadata

Use `python build.py --version <tag>` to embed an explicit release tag.
Without it, the build derives an ID from Git: a clean tagged commit uses its tag; later commits use `<tag>-<distance>-g<hash>`, with `-dirty` appended for tracked edits.
Without a reachable version tag, Git falls back to the commit hash.
Outside a Git checkout, pass `--version` explicitly.

Use `--repository <owner/repo>` to identify the source repository.
Local builds infer it from a GitHub `origin` using HTTPS, scp-style SSH, or `ssh://`; without an origin, they fall back to `lee-lab-skku/zotero-actionstags-actions`.
For a non-GitHub origin, specify `--repository` explicitly.
Release CI supplies the tag and `GITHUB_REPOSITORY` automatically.

The backup stores these values in top-level `version` and `repository` fields.
The updater also embeds them as `INSTALLED_VERSION` and `SOURCE_REPOSITORY` constants inside standard action `data`, which Actions & Tags preserves during editor saves.
Do not rely on custom action metadata to retain them.

## Verification metadata

Every build records one UTC ISO 8601 creation time in the standard backup-root `timestamp`, shared by YAML and JSON.
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

See [distribution contracts](../CONTRIBUTING.md#distribution-contracts) for requirements shared by the backups and skill archive.
