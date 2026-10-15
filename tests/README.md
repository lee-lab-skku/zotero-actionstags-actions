# Test suites

Tests are grouped by what they verify.
The default local checks are `unit/`, `build/`, and `tooling/`; they require no installed Zotero, display, external network access, or loopback binding.

| Directory | Purpose | Execution requirements |
| --- | --- | --- |
| `unit/` | Action logic and API-boundary behavior, using Zotero/A&T test doubles | Node.js; local and CI |
| `build/` | CLI validation, Git provenance, backup equivalence, generated updater behavior, and standalone skill packaging | Python, PyYAML, Git and Node.js; local and CI |
| `tooling/` | Coverage runner and checks of the action harness and source-map reporting | Node.js for tooling tests; optional coverage.py for the coverage command |
| `support/` | Shared action runner and bridge test doubles | Imported by suites; not a test suite |
| `integration/http/` | A real HTTP client/socket against the bridge endpoint with mocked Zotero/A&T | Node.js and loopback binding; separate local command and CI step |
| `integration/zotero/` | Disposable-profile fixture with actual Zotero data objects and plugins | Fixed app/plugin pair in manual and release CI, or installed Zotero and supplied XPIs; [verification/profile instructions](integration/zotero/README.md) |

## Local checks

From the repository root:

```sh
python -m unittest discover -s tests/build -p 'test_*.py'
node --test tests/unit/*.test.cjs tests/tooling/*.test.cjs
```

The HTTP socket check is separate:

```sh
node --test tests/integration/http/*.test.cjs
```

CI executes the local suites and the HTTP socket suite.
See [CI and release workflow](../docs/releases.md#ci-workflows) for the current execution environment and triggers.
Real Zotero integration verification is a separate workflow invoked manually and required for releases; see [execution and scope](integration/zotero/README.md).
Its automated checks do not replace UI import, URI-opening or shared-library checks.

## Coverage and expectations

```sh
python -m pip install "coverage>=7.10,<8"
python tests/tooling/run-coverage.py
```

Coverage runs `unit/`, `tooling/`, and `build/`, reporting original action sources and `build.py`.
Integration suites are excluded from this local coverage command.
JavaScript uses Node's built-in experimental coverage with source maps to measure every original `src/*.js` action body.
Python coverage includes subprocess builds and maps temporary checkout copies back to `build.py`.
Generated wrappers and reports stay in ignored `coverage/`: action coverage at `actions.lcov`, Python HTML at `python/index.html`, and Python JSON at `build.json`.
Coverage helps identify missing cases; it does not establish API compatibility or replace behavioral assertions.
[API contracts and test oracles](API-contracts.md) records the basis for expected results and the limits of the doubles.
[CONTRIBUTING.md](../CONTRIBUTING.md) contains the complete setup and validation commands.

## Manual release checks

Test in a disposable Zotero 10 profile with compatible Actions & Tags and optional Better Notes/Better BibTeX versions:

1. Import the generated YAML and verify menu actions and startup events.
1. Copy links from a single collection, mixed collection/search selection, multiple libraries, and a reader; include standalone attachments and notes.
1. Verify authenticated bridge requests and returned links using the [disposable profile fixture](integration/zotero/README.md).
   Open returned URIs and check shared-library targets manually.
1. Verify Delete moves collection items to trash and Shift+Delete removes them from the collection, including confirmation, Undo, and multiple selected collections.
   Check Enable transitions and that editing, modified keys, and other views keep their usual behavior.
1. Verify review dates around local midnight and preference setup with missing or stale groups/collections.
1. Verify WebDAV failures and a release update with a failed download or write.
1. Verify Set Preferences focuses No for prerelease opt-in, remembers the startup choice, and permits changing it manually.
   Check startup/manual updater dispatch, no dialog for equal or older releases, intermediate-version selection, cancellation, and YAML-only labels.
