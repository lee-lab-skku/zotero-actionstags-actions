# Contributing

This guide defines the development workflow and contracts to preserve when changing the actions, builds, and bundled agent skill.
User installation and configuration belong in [README.md](README.md).

## Development setup

Use Python 3.10 or later, PyYAML, Git, and Node.js 22 or later.
There are no Node package dependencies.
From the repository root, run:

```sh
python -m pip install PyYAML
python build.py
python build_skill.py
python -m unittest discover -s tests/build -p 'test_*.py'
node --test tests/unit/*.test.cjs tests/tooling/*.test.cjs
git diff --check
```

These local checks cover action logic, builds, and test tooling without Zotero, a display, network access, or socket binding.
Run the HTTP integration suite separately when loopback binding is available:

```sh
node --test tests/integration/http/*.test.cjs
```

### Making a change

- Edit action bodies in `src/` and their matching plugin definitions in `meta/`.
  Keep generated backups and skill archives in the ignored `dist/` directory.
- Preserve the [action contracts](#action-contracts) and update relevant behavioral tests.
  Consult [API contracts and test oracles](tests/API-contracts.md) for source-backed expectations and integration boundaries.
- Keep user setup in README and contributor guidance here.
  For link-bridge interface changes, update the installable [zot-jot skill](skills/zot-jot/SKILL.md) and its [API reference](skills/zot-jot/references/api.md), keeping all skill resources self-contained.
- Run the local checks above and any integration checks relevant to the change.
  Before a release, meet the [release requirements](#release-requirements).

## Action contracts

### Execution and selection

Each source script must remain independently usable as an Actions & Tags async function body, including top-level `await` and `return`.
Use the plugin's injected `require` to obtain Zotero and Mozilla globals.
Keep persisted action keys and numeric event/operation values stable.
Script actions require a matching source file and an explicit event, including `event: 0` for menu-only actions.

Selection actions run with `items` and no `item`; per-item actions must ignore that selection-level invocation.
When dispatching a selection action explicitly, pass `itemIDs` without `itemID`.
Startup scripts must not assume that item or collection arguments exist.
Global menu commands must run once per selection without changing other actions or non-menu dispatches.
Per-action running guards must be released in `finally`, including early returns and failures.

### Zotero APIs and user data

Target Zotero 10 APIs.
Use plural collection selection getters and handle mixed selections and multiple libraries without choosing an arbitrary collection.
Use `Zotero.Libraries.userLibraryID`, not a hardcoded personal library ID.
Escape user text before inserting it into HTML clipboard content or notes.

The updater must validate the full backup before applying changes, apply its own action last, and record its version only after every write succeeds.
Preserve users' enabled settings and shortcuts when updating existing actions.
Do not download and evaluate parser code to decode release data.

### Link bridge boundary

The bridge uses the public `Zotero.ActionsTags.api.actionManager.dispatchActionByKey()` API.
The dispatcher consumes return values and catches exceptions, so bridge result delivery must remain bound to the originating action, target, collection, and agent request.
Menu calls and sharing calls keep their ordinary behavior.

The endpoint supports link generation, without exposing arbitrary action execution, script evaluation, metadata writes, or Better BibTeX settings.
Shutdown removes the bridge endpoint without stopping Zotero's shared server.

## Distribution contracts

Publish the YAML and JSON backups with identical action definitions and the skill ZIP from the same release tag and commit.
The skill must remain installable on its own, with all referenced resources inside its directory and relative paths preserved.
Keep its ZIP download link and tagged directory link aligned with the published assets.
Skill installation remains separate from Zotero action imports and updates.

Preserve version and repository provenance through Actions & Tags editor saves; custom action metadata cannot be relied on for this.
Record the same creation timestamp in both backups.
Verification metadata must match the actual runtime pair checked and must not imply broader compatibility or test coverage.

See [building distributable files](docs/building.md) for build options, metadata fields, and packaging details.

## Verification requirements

Run the default local checks for changes and relevant integration checks when their execution requirements are available.
Use [API contracts and test oracles](tests/API-contracts.md) to distinguish behavior established by test doubles from behavior requiring real-app verification.
Coverage is an aid to finding missing cases; it does not replace behavioral assertions or establish API compatibility.

See [test suites](tests/README.md) for suite scope, coverage commands, and manual release checks, and [real Zotero verification](tests/integration/zotero/README.md) for disposable-profile instructions and current automation limits.

## Release requirements

Require the shared test workflow and real Zotero integration verification to pass on the release commit.
Complete the [manual release checks](tests/README.md#manual-release-checks) in a disposable profile for behavior outside automated coverage.
Publish the tested backups and skill archive from that commit without rebuilding them after verification.
Publication must use the same release body and assets prepared for review; manual preview runs must not create tags or releases.

See [release workflow](docs/releases.md) for CI behavior, preview instructions, and artifact retrieval.

### Versioning and prereleases

Versions are recorded in Git tags and `CHANGELOG.md`; there is no separate package version file.
Use `vMAJOR.MINOR.PATCH` for stable releases and a SemVer suffix such as `v3.0.0-beta.1` for prereleases.
Move completed changes from `Unreleased` into the matching version section, then tag that release commit.
Place behavior changes under `Changed`, reserve `Fixed` for corrections, and prefix incompatible entries with **Breaking:**.
The release workflow marks tags containing a prerelease suffix as GitHub prereleases.

## API references

- [Zotero 10 migration guide](https://www.zotero.org/support/dev/zotero_10_for_developers)
- [Zotero 10.0.1 source](https://github.com/zotero/zotero/tree/10.0.1)
- [Actions & Tags script execution and action management](https://github.com/windingwind/zotero-actions-tags/blob/master/src/utils/actions.ts)
- [Actions & Tags public API](https://github.com/windingwind/zotero-actions-tags/blob/master/src/api.ts)
