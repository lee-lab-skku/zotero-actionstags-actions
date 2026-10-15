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
Real Zotero integration verification is a separate workflow invoked manually and required for releases; see [execution and scope](integration/zotero/README.md).
Its automated checks do not replace UI import, URI-opening or shared-library checks.

## Coverage and expectations

```sh
python -m pip install "coverage>=7.10,<8"
python tests/tooling/run-coverage.py
```

Coverage runs `unit/`, `tooling/`, and `build/`, reporting original action sources and `build.py`.
Integration suites are excluded from this local coverage command.
Generated wrappers, LCOV, and Python HTML/JSON reports are written to ignored `coverage/`.
[API contracts and test oracles](API-contracts.md) records the basis for expected results and the limits of the doubles.
[CONTRIBUTING.md](../CONTRIBUTING.md) contains the complete setup and validation commands.
