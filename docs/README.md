# Documentation

These guides cover client setup for users, and documentation, builds, and releases for contributors.
Start with the repository [README](../README.md) to install the actions, or [Contributing](../CONTRIBUTING.md) to prepare a development checkout.

## Using the actions

[Agent link setup](agent-links.md) covers profile authentication, client configuration, skill installation, and troubleshooting.
The installable [zot-jot skill](../skills/zot-jot/SKILL.md) guides agents through link requests and result validation.
Its self-contained [Action link API](../skills/zot-jot/references/api.md) defines request fields, annotation options, responses, and errors for all clients.

## Contributing changes

Use these guides to maintain the documentation and prepare distributable artifacts:

- [Documentation workflow](documentation.md) covers mddt placement and review, local checks, and CI's floating checker revision.
- [Building distributable files](building.md) covers backup generation, version and verification metadata, and agent skill packaging.
- [Release workflow](releases.md) covers CI verification, release previews, and publication of the prepared artifacts.

## Testing

[Test suites](../tests/README.md) describes local checks, coverage, and manual release checks.
[Real Zotero integration verification](../tests/integration/zotero/README.md) describes the automated fixture's scope and disposable-profile setup.
