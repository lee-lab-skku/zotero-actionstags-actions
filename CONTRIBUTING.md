# Contributing

## Setup and validation

Use Python 3.10 or later with PyYAML and Node.js 22 or later.
There are no Node package dependencies.

```sh
python -m pip install PyYAML
python build.py
python -m unittest discover -s tests -p 'test_*.py'
node --test tests/actions.test.cjs
git diff --check
```

The build resolves paths relative to `build.py`, so it can run from another working directory.
Generated release files belong in the ignored `dist/` directory.
Publish both YAML and JSON assets together; both must contain the same action definitions.
The tag release workflow uploads both files.

## Versioning and prereleases

Versions are recorded in Git tags and `CHANGELOG.md`; there is no separate package version file.
Use `vMAJOR.MINOR.PATCH` for stable releases and a SemVer suffix such as `v3.0.0-beta.1` for prereleases.
Move completed changes from `Unreleased` into the matching version section, then tag that release commit.
Place behavior changes under `Changed`, reserve `Fixed` for corrections, and prefix incompatible entries with **Breaking:**.
The release workflow marks tags containing a prerelease suffix as GitHub prereleases.

Install beta builds by importing their YAML file manually.
Keep Update Actions disabled while testing a beta: its GitHub latest-release endpoint tracks stable releases, not prereleases, and it does not prevent installing an older stable version.

## Action contracts

Each source script must remain independently usable as an Actions & Tags async function body, including top-level `await` and `return`.
Use the plugin's injected `require` to obtain Zotero and Mozilla globals.
Selection actions run with `items` and no `item`; per-item actions must ignore that selection-level invocation.
When dispatching a selection action explicitly, pass `itemIDs` without `itemID`.
Startup scripts must not assume that item or collection arguments exist.

Keep persisted action keys and numeric event/operation values stable.
Script actions require a matching source file and an explicit event, including `event: 0` for menu-only actions.
Keep the copy helper in the share and retrieve scripts equivalent so both remain standalone and preserve the same data.

Target Zotero 10 APIs.
Use plural collection selection getters and handle mixed selections and multiple libraries without choosing an arbitrary collection.
Use `Zotero.Libraries.userLibraryID`, not a hardcoded personal library ID.
Escape user text before inserting it into HTML clipboard content or notes.

Before copying between libraries, validate permissions and local file availability.
Use Zotero cloning and attachment/note APIs to preserve tags, notes, embedded images, and annotations.
Do not permanently erase the source during retrieval.
Only trash it after the destination copy commits, with a Zotero 10 undo label.
Database transactions do not roll back filesystem copies; an I/O failure can leave unreferenced destination storage files, although the source must remain intact.
Cross-library related-item relationships and links embedded inside note text are not remapped by these actions.

The updater must validate the full backup before applying changes and record its version only after every write succeeds.
Do not download and evaluate parser code to decode release data.
Preserve users' enabled settings and shortcuts when updating existing actions.

## Verification boundaries

Automated tests execute the actual action bodies with mocked Zotero/Actions & Tags APIs.
They verify selection contexts, escaping, preference migration, network failures, update failures, and copy-before-trash ordering.
They do not prove that a real Zotero database, filesystem, plugin UI, or sync server behaves correctly.

Before releasing, test in a disposable Zotero 10 profile with compatible Actions & Tags and optional Better Notes/Better BibTeX versions:

1. Import the generated YAML and verify menu actions and startup events.
1. Copy links from a single collection, mixed collection/search selection, multiple libraries, and a reader; include standalone attachments and notes.
1. Share and retrieve an item with tags, a note containing an image, a stored PDF with Zotero annotations, a linked file, and a URL attachment.
1. Verify missing files and read-only libraries stop copying and leave the source intact.
1. Verify retrieval places the source in the group trash and Undo restores it while retaining the destination copy.
1. Verify review dates around local midnight and preference setup with missing or stale groups/collections.
1. Verify WebDAV failures and a release update with a failed download or write.

## API references

- [Zotero 10 migration guide](https://www.zotero.org/support/dev/zotero_10_for_developers)
- [Zotero 10.0.1 source](https://github.com/zotero/zotero/tree/10.0.1)
- [Actions & Tags script execution and action management](https://github.com/windingwind/zotero-actions-tags/blob/master/src/utils/actions.ts)
- [Actions & Tags public API](https://github.com/windingwind/zotero-actions-tags/blob/master/src/api.ts)
