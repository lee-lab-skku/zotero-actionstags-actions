# Contributing

This guide defines the development workflow and contracts to preserve when changing the actions, builds, and bundled agent skill.
User installation and configuration belong in [README.md](README.md).

## Development setup

Use Python 3.10 or later, PyYAML, Git, and Node.js 22 or later.
There are no Node package dependencies.
Markdown checks additionally need uv and Python 3.11 or later; CI uses Python 3.12 for both builds and documentation.

### Local checks

From the repository root, run:

```sh
python build.py
python build_skill.py
python -m unittest discover -s tests/build -p 'test_*.py'
node --test tests/unit/*.test.cjs tests/tooling/*.test.cjs
```

These local checks cover action logic, builds, and test tooling without Zotero, a display, network access, or socket binding.
Run the HTTP integration suite separately when loopback binding is available:

```sh
node --test tests/integration/http/*.test.cjs
```

### Making a change

These requirements apply across changes:

- **Behavioral contracts**: Preserve the [action contracts](#action-contracts) and update relevant behavioral tests.
  Consult [API contracts and test oracles](tests/API-contracts.md) for source-backed expectations and integration boundaries.
- **Generated files**: Keep generated backups and skill archives in the ignored `dist/` directory.
- **Verification**: Run the [local checks](#local-checks) and any integration checks relevant to the change.
  Before a release, meet the [release requirements](#release-requirements).

Apply these additional requirements to the code or documents you change:

- **Action code**: Edit bodies in `src/` and their matching plugin definitions in `meta/`.
  For link-bridge interface changes, update the installable [zot-jot skill](skills/zot-jot/SKILL.md) and its [API reference](skills/zot-jot/references/api.md), keeping all skill resources self-contained.
- **Markdown documents**: Follow the [Documentation workflow](docs/documentation.md) for content placement and mddt's writing procedure.
  Place content before writing, then reread each changed topic whole once it settles.
  Review placement, document kinds, and summaries as well as checker findings.
  Run the [Markdown check](docs/documentation.md#checking-markdown).
  Report the checker revision, files checked, and retained findings with their reasons in the change description.

## Action contracts

These contracts govern action execution, Zotero API use, user data handling, and the link bridge boundary.

### Execution and selection

- **Script bodies**: Each source script must remain independently usable as an Actions & Tags async function body, including top-level `await` and `return`.
  Use the plugin's injected `require` to obtain Zotero and Mozilla globals.
- **Persisted definitions**: Keep persisted action keys and numeric event/operation values stable.
  Script actions require a matching source file and an explicit event, including `event: 0` for menu-only actions.
- **Selection invocation**: Selection actions run with `items` and no `item`; per-item actions must ignore that selection-level invocation.
  When dispatching a selection action explicitly, pass `itemIDs` without `itemID`.
- **Startup arguments**: Startup scripts must not assume that item or collection arguments exist.

### Zotero APIs and user data

- **API version**: Target Zotero 10 APIs.
- **Collection selection**: Use plural collection selection getters and handle mixed selections and multiple libraries without choosing an arbitrary collection.
- **Personal library**: Use `Zotero.Libraries.userLibraryID`, not a hardcoded personal library ID.
- **User text**: Escape user text before inserting it into HTML clipboard content or notes.

### Link bridge boundary

The bridge uses the public `Zotero.ActionsTags.api.actionManager.dispatchActionByKey()` API.
The dispatcher consumes return values and catches exceptions, so bridge result delivery must remain bound to the originating action, target, collection, and agent request.
Menu calls keep their ordinary clipboard behavior.

The endpoint supports link generation, without exposing arbitrary action execution, script evaluation, metadata writes, or Better BibTeX settings.
Shutdown removes the bridge endpoint without stopping Zotero's shared server.

### API references

- [Zotero 10 migration guide](https://www.zotero.org/support/dev/zotero_10_for_developers)
- [Zotero 10.0.1 source](https://github.com/zotero/zotero/tree/10.0.1)
- [Actions & Tags script execution and action management](https://github.com/windingwind/zotero-actions-tags/blob/master/src/utils/actions.ts)
- [Actions & Tags public API](https://github.com/windingwind/zotero-actions-tags/blob/master/src/api.ts)

## Distribution and releases

These requirements cover distributable artifacts, verification, publication, and versioning.

### Distribution contracts

Preserve these contracts when preparing artifacts:

- **Action scope**: Distribute only `copySelectionLink`, `copyAnnotationLink`, `copyNoteLink`, and `linkBridge`.
  Updates are manual imports; do not include legacy automation or retirement placeholders.
- **Release alignment**: Publish the YAML backup and skill ZIP from the same release tag and commit.
  Keep its ZIP download link and tagged directory link aligned with the published assets.
- **Skill independence**: The skill must remain installable on its own, with all referenced resources inside its directory and relative paths preserved.
  Skill installation remains separate from Zotero action imports and updates.
- **Provenance**: Keep version and repository provenance in the backup root; do not add custom action metadata for it.
  Record the backup's UTC creation timestamp.
  Verification metadata must match the actual runtime pair checked and must not imply broader compatibility or test coverage.

See [building distributable files](docs/building.md) for build options, metadata fields, and packaging details.

### Verification requirements

Run the default local checks for changes and relevant integration checks when their execution requirements are available.
Use [API contracts and test oracles](tests/API-contracts.md) to distinguish behavior established by test doubles from behavior requiring real-app verification.
Coverage is an aid to finding missing cases; it does not replace behavioral assertions or establish API compatibility.

See [test suites](tests/README.md) for suite scope, coverage commands, and manual release checks, and [real Zotero verification](tests/integration/zotero/README.md) for disposable-profile instructions and current automation limits.

### Release requirements

Before publication, meet these requirements:

- **Automated verification**: Require the shared test workflow and real Zotero integration verification to pass on the release commit.
- **Manual verification**: Complete the [manual release checks](tests/README.md#manual-release-checks) in a disposable profile for behavior outside automated coverage.
- **Published artifacts**: Publish the tested backup and skill archive from that commit without rebuilding them after verification.
  Publication must use the same release body and assets prepared for review.
- **Preview runs**: Manual preview runs must not create tags or releases.

See [release workflow](docs/releases.md) for CI behavior, preview instructions, and artifact retrieval.

### Versioning and prereleases

Versions are recorded in Git tags and `CHANGELOG.md`; there is no separate package version file.
Use `vMAJOR.MINOR.PATCH` for stable releases and a SemVer suffix such as `v3.0.0-beta.1` for prereleases.
Make sure the changelog reflects the changes before release.
The release workflow marks tags containing a prerelease suffix as GitHub prereleases.
