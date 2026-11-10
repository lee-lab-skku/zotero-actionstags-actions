# Test suites

This guide maps the test suites to their execution requirements and covers local checks, coverage, and manual release checks.
The default local suites are `unit/`, `build/`, and `tooling/`; they require no installed Zotero, display, external network access, or loopback binding.

## Suite selection

Choose a suite according to the boundary being checked:

| Directory | Purpose | Execution requirements |
| --- | --- | --- |
| `unit/` | Action logic and API-boundary behavior, using Zotero/A&T test doubles | Node.js; local and CI |
| `build/` | CLI validation, Git provenance, four-action backup scope and equivalence, and standalone skill packaging | Python, PyYAML, Git and Node.js; local and CI |
| `tooling/` | Coverage runner and checks of the action harness and source-map reporting | Node.js for tooling tests; optional coverage.py for the coverage command |
| `support/` | Shared action runner and bridge test doubles | Imported by suites; not a test suite |
| `integration/http/` | A real HTTP client/socket against the bridge endpoint with mocked Zotero/A&T | Node.js and loopback binding; separate local command and CI step |
| `integration/zotero/` | Disposable-profile fixture with actual Zotero data objects and plugins | Fixed app/plugin pair in manual and release CI, or installed Zotero and supplied XPIs; [verification/profile instructions](integration/zotero/README.md) |

## Local checks

Follow [Contributing](../CONTRIBUTING.md#development-setup) for dependencies, builds, and the canonical local and HTTP socket commands.
For Markdown changes, also follow the [Documentation workflow](../docs/documentation.md) for mddt review and checks.

CI executes the local suites and the HTTP socket suite.
See [CI and release workflow](../docs/releases.md#ci-workflows) for the current execution environment and triggers.
Real Zotero integration verification is a separate workflow invoked manually and required for releases; see [execution and scope](integration/zotero/README.md).
Its automated checks do not replace UI import, URI-opening or shared-library checks.

## Coverage and expectations

Install coverage.py and run the local coverage command from the repository root:

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

## Manual release checks

Test in a disposable Zotero 10 profile with compatible Actions & Tags and optional Better Notes/Better BibTeX versions:

1. Import the generated YAML and verify menu actions and startup events.
1. Copy links from a single collection, mixed collection/search selection, multiple libraries, and a reader; include standalone attachments and notes.
1. Verify authenticated bridge requests and returned links using the [disposable profile fixture](integration/zotero/README.md).
   Open returned URIs and check shared-library targets manually.
