# Contributing

## Setup and validation

Use Python 3.10 or later with PyYAML and Node.js 22 or later.
There are no Node package dependencies.

```sh
python -m pip install PyYAML
python build.py
python -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.test.cjs
git diff --check
```

CI runs these checks on Ubuntu 24.04 with Python 3.12 and Node.js 22 for branch pushes, pull requests, and manual runs.
Tag releases call the same test workflow and publish only after it succeeds; tests and release builds check out the triggering commit SHA.
Tag pushes do not start a second standalone test run.
Superseded branch/PR test runs are cancelled, while release runs are serialized per tag without cancelling an active release.
External actions are pinned to release commit SHAs.

The build resolves paths relative to `build.py`, so it can run from another working directory.
Use `python build.py --version <tag>` to embed a release tag in Update Actions for direct YAML/JSON installation.
Without an explicit version, `python build.py` derives a Git build ID: a clean tagged commit uses its tag, and later commits use `<tag>-<distance>-g<hash>`, adding `-dirty` for tracked edits.
The same ID is stored in the backup’s top-level `version` and the updater’s `INSTALLED_VERSION` code constant.
The source is stored in the backup-root `repository` and the updater’s `SOURCE_REPOSITORY` constant.
These values stay inside standard action `data`, which A&T preserves during editor saves; do not depend on custom action metadata.
Without a reachable version tag, Git falls back to the commit hash; outside a Git checkout, pass `--version` explicitly.
Use `--repository <owner/repo>` to identify the source in the backup root and updater code.
Local builds infer the source from a GitHub `origin` (HTTPS, scp-style SSH, or `ssh://`); without an origin they fall back to `lee-lab-skku/zotero-actionstags-actions`.
For a non-GitHub origin, specify `--repository` explicitly.
The release workflow passes its tag and `GITHUB_REPOSITORY` automatically.
Generated release files belong in the ignored `dist/` directory.
Publish both YAML and JSON assets together; both must contain the same action definitions.
The tag release workflow uploads both files.

## Versioning and prereleases

Versions are recorded in Git tags and `CHANGELOG.md`; there is no separate package version file.
Use `vMAJOR.MINOR.PATCH` for stable releases and a SemVer suffix such as `v3.0.0-beta.1` for prereleases.
Move completed changes from `Unreleased` into the matching version section, then tag that release commit.
Place behavior changes under `Changed`, reserve `Fixed` for corrections, and prefix incompatible entries with **Breaking:**.
The release workflow marks tags containing a prerelease suffix as GitHub prereleases.

Install the new interactive updater initially by importing its YAML file manually.
Update Actions is disabled by default; enable it for startup checks. Set preferences controls prerelease inclusion and defaults to No.
The updater compares release SemVer tags with the installed base tag, asks before applying a newer release, and never offers equal or older versions.

## Action contracts

Each source script must remain independently usable as an Actions & Tags async function body, including top-level `await` and `return`.
Use the plugin's injected `require` to obtain Zotero and Mozilla globals.
Selection actions run with `items` and no `item`; per-item actions must ignore that selection-level invocation.
When dispatching a selection action explicitly, pass `itemIDs` without `itemID`.
Startup scripts must not assume that item or collection arguments exist.
Global actions guard their own item-level menu follow-up dispatches at the public action manager boundary; keep other actions and non-menu dispatches unchanged.
Per-action running guards must be released in `finally`, including early returns and failures.

Keep persisted action keys and numeric event/operation values stable.
Script actions require a matching source file and an explicit event, including `event: 0` for menu-only actions.

Target Zotero 10 APIs.
Use plural collection selection getters and handle mixed selections and multiple libraries without choosing an arbitrary collection.
Use `Zotero.Libraries.userLibraryID`, not a hardcoded personal library ID.
Escape user text before inserting it into HTML clipboard content or notes.

The updater must validate the full backup before applying changes and record its version only after every write succeeds.
Do not download and evaluate parser code to decode release data.
Preserve users' enabled settings and shortcuts when updating existing actions.

## Verification boundaries

Automated tests execute the actual action bodies with mocked Zotero/Actions & Tags APIs.
They verify selection contexts, escaping, preference setup, network failures, and update failures.
The bridge suite also uses a real localhost HTTP socket with mocked Zotero/Actions & Tags APIs; the test environment must allow binding to loopback.
They do not prove that a real Zotero database, filesystem, plugin UI, or sync server behaves correctly.

Before releasing, test in a disposable Zotero 10 profile with compatible Actions & Tags and optional Better Notes/Better BibTeX versions:

1. Import the generated YAML and verify menu actions and startup events.
1. Copy links from a single collection, mixed collection/search selection, multiple libraries, and a reader; include standalone attachments and notes.
1. Verify the bridge's authenticated requests and returned links using the [disposable profile fixture](tests/manual/README.md); also open the returned URIs and check shared-library targets manually.
1. Verify Delete moves collection items to trash and Shift+Delete removes them from the collection, including confirmation, Undo, and multiple selected collections. Check Enable transitions and that editing, modified keys, and other views retain their usual behavior.
1. Verify review dates around local midnight and preference setup with missing or stale groups/collections.
1. Verify WebDAV failures and a release update with a failed download or write.
1. Verify Set preferences focuses No for prerelease opt-in, remembers the startup choice, and permits changing it manually. Check startup/manual updater dispatch, no dialog for equal or older releases, intermediate-version selection, cancellation, and YAML-only labels in a disposable profile.

## API references

- [Zotero 10 migration guide](https://www.zotero.org/support/dev/zotero_10_for_developers)
- [Zotero 10.0.1 source](https://github.com/zotero/zotero/tree/10.0.1)
- [Actions & Tags script execution and action management](https://github.com/windingwind/zotero-actions-tags/blob/master/src/utils/actions.ts)
- [Actions & Tags public API](https://github.com/windingwind/zotero-actions-tags/blob/master/src/api.ts)
