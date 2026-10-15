# Contributing

## Setup and validation

Use Python 3.10 or later with PyYAML and Node.js 22 or later.
There are no Node package dependencies.

```sh
python -m pip install PyYAML
python build.py
python build_skill.py
python -m unittest discover -s tests/build -p 'test_*.py'
node --test tests/unit/*.test.cjs tests/tooling/*.test.cjs
git diff --check
```

The default local suite includes action units, build checks, and test-tooling checks; it needs no Zotero installation, display, network connection, or socket binding.
See [test suites](tests/README.md) for their purposes and execution requirements.
The HTTP socket check is separate: `node --test tests/integration/http/*.test.cjs`.
CI runs the default local checks and the HTTP socket suite.
The [real Zotero integration workflow](tests/integration/zotero/README.md#ci-verification) runs one fixed app/plugin pair in a disposable profile under Xvfb, on manual invocation and as a release requirement.

For local coverage, install the optional Python tool and run:

```sh
python -m pip install "coverage>=7.10,<8"
python tests/tooling/run-coverage.py
```

JavaScript uses Node's built-in experimental coverage with source maps; there are no Node package dependencies.
The report measures every original `src/*.js` action body and writes `coverage/actions.lcov`.
Python coverage includes subprocess builds and merges temporary checkout copies into `build.py`, with HTML at `coverage/python/index.html` and JSON at `coverage/build.json`.
Generated test wrappers and reports stay in ignored `coverage/`.
Coverage is an aid to finding missing cases; it does not establish API compatibility or replace behavioral assertions.
See [API contracts and test oracles](tests/API-contracts.md) for the source-backed expectations and remaining integration boundaries.

CI runs these checks on Ubuntu 24.04 with Python 3.12 and Node.js 22 for branch pushes, pull requests, and manual runs.
Tag releases require both the shared test workflow and real Zotero integration verification to succeed on the triggering commit SHA.
The integration workflow builds the release YAML/JSON once, verifies their action definitions in the actual app, and uploads them for publication without rebuilding.
The shared test workflow validates and packages the agent skill, checks the standalone archive in its build tests, and uploads the ZIP for tag releases and manual runs.
Release preparation downloads that tested ZIP alongside the verified backups; all three assets come from the same triggering commit.
It renders the release body once, shows the body and asset sizes in the run summary, and uploads the body and assets together.
Tag publication consumes this prepared bundle without rebuilding or rendering the body again.
Tag pushes do not start a second standalone test run.
Superseded branch/PR test runs are cancelled, while release runs are serialized per tag without cancelling an active release.
External actions use major version tags to receive compatible updates.

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
The tag release workflow publishes both files from the successful integration job.

Every build records a single UTC ISO 8601 creation time in A&T's standard backup-root `timestamp`, shared by YAML and JSON.
Use `--platform-version <Zotero version> --plugin-version <Actions & Tags version>` together to record the pair being verified in the standard `platformVersion` and `pluginVersion` fields.
Local builds omit those version fields unless explicitly supplied; supplying them alone does not establish successful verification.
Release CI supplies the fixed pair, requires matching actual runtime versions, and publishes only after verification succeeds.
These fields describe the checked environment, not a compatibility range or coverage of every action and optional plugin.
See [verification scope and artifact handling](tests/integration/zotero/README.md#ci-verification).

## Release preview

Run **Build and Release** manually, selecting the branch and an intended `preview_tag` (default `v0.0.0-preview`).
Manual runs execute the same tests and real Zotero verification as tag releases, using the intended tag as the backup version and in the release-body links.
After verification, inspect the rendered body and asset sizes in the run summary and download `release-bundle-<commit SHA>` from the run artifacts.
The bundle contains `release-body.md`, `actions-zotero.yml`, `actions-zotero.json`, and `zot-jot.zip`, retained for seven days.
The links preview the intended release URLs; they may not resolve before that tag and release exist.
Dispatch never creates a tag or GitHub Release, including when dispatched against an existing tag.
Only tag pushes can run the publication job, which uses the same body and assets prepared by that run.
The standalone **Test** workflow also uploads the skill ZIP on manual runs, without preparing the full release bundle.

## Agent skill packaging

Run `python build_skill.py` to validate and package `skills/zot-jot` as `dist/zot-jot.zip`.
The archive contains a top-level `zot-jot/` directory with `SKILL.md` and its resources, preserving paths relative to the skill entry.
Validation checks the skill name and description, local Markdown document targets, and self-contained resources; it rejects missing references and symbolic links.
Packaging checks archive entries and bytes, with stable timestamps and permissions so unchanged payloads produce identical archives.
The build tests also extract the archive and validate the resulting standalone skill.
These checks establish package integrity, not actual agent discovery or link generation behavior.
Publish the ZIP with the YAML and JSON from the same release tag; skill installation remains separate from Zotero action import and updates.
The release description includes a direct ZIP download link and a tagged skill-directory link, derived from the publishing server, repository, and tag.
Keep both links aligned with the uploaded asset name and installable skill path.

## Versioning and prereleases

Versions are recorded in Git tags and `CHANGELOG.md`; there is no separate package version file.
Use `vMAJOR.MINOR.PATCH` for stable releases and a SemVer suffix such as `v3.0.0-beta.1` for prereleases.
Move completed changes from `Unreleased` into the matching version section, then tag that release commit.
Place behavior changes under `Changed`, reserve `Fixed` for corrections, and prefix incompatible entries with **Breaking:**.
The release workflow marks tags containing a prerelease suffix as GitHub prereleases.

Install the new interactive updater initially by importing its YAML file manually.
Update Actions is enabled by default for startup checks; updates preserve its existing enabled setting.
Set preferences controls prerelease inclusion and defaults to No.
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
The separate integration suite uses a real localhost HTTP socket with mocked Zotero/Actions & Tags APIs; that suite requires loopback binding.
Real-app behavioral verification is required before release.
Its current automation is an initial, PoC-level implementation checking a limited path through the actual database, plugin dispatcher, and HTTP server.
It does not cover the plugin UI, clipboard, reader UI, shared libraries, or sync server.

Before releasing, test in a disposable Zotero 10 profile with compatible Actions & Tags and optional Better Notes/Better BibTeX versions:

1. Import the generated YAML and verify menu actions and startup events.
1. Copy links from a single collection, mixed collection/search selection, multiple libraries, and a reader; include standalone attachments and notes.
1. Verify the bridge's authenticated requests and returned links using the [disposable profile fixture](tests/integration/zotero/README.md); also open the returned URIs and check shared-library targets manually.
1. Verify Delete moves collection items to trash and Shift+Delete removes them from the collection, including confirmation, Undo, and multiple selected collections. Check Enable transitions and that editing, modified keys, and other views retain their usual behavior.
1. Verify review dates around local midnight and preference setup with missing or stale groups/collections.
1. Verify WebDAV failures and a release update with a failed download or write.
1. Verify Set preferences focuses No for prerelease opt-in, remembers the startup choice, and permits changing it manually. Check startup/manual updater dispatch, no dialog for equal or older releases, intermediate-version selection, cancellation, and YAML-only labels in a disposable profile.

## Link bridge documentation and dispatch boundary

The agent workflow and public HTTP contract live in [`skills/zot-jot`](skills/zot-jot/SKILL.md); update the skill and its API reference when the interface changes.
Keep user setup instructions in README and preserve references inside the installable skill directory.

The bridge uses the public `Zotero.ActionsTags.api.actionManager.dispatchActionByKey()` API.
That dispatcher consumes script return values and catches exceptions, so the copylink actions report through a temporary result receiver bound to the action, target IDs, collection, and agent trigger.
Menu calls and sharing calls keep their ordinary behavior.
This endpoint does not expose arbitrary action execution, script evaluation, metadata writes, or Better BibTeX settings.

Shutdown removes the bridge endpoint without stopping Zotero's shared server.

## API references

- [Zotero 10 migration guide](https://www.zotero.org/support/dev/zotero_10_for_developers)
- [Zotero 10.0.1 source](https://github.com/zotero/zotero/tree/10.0.1)
- [Actions & Tags script execution and action management](https://github.com/windingwind/zotero-actions-tags/blob/master/src/utils/actions.ts)
- [Actions & Tags public API](https://github.com/windingwind/zotero-actions-tags/blob/master/src/api.ts)
