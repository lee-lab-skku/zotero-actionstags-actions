# Release workflow

This guide describes the CI release pipeline and how to inspect a release preview before publication.
Follow the [release requirements](../CONTRIBUTING.md#release-requirements) and complete the [manual release checks](../tests/README.md#manual-release-checks) before publishing.
See [building distributable files](building.md) for build options and artifact metadata.

## CI workflows

Releases combine documentation and code checks with real Zotero verification, then publish the exact prepared artifacts.

### Checks and triggers

The shared **Test** workflow runs on branch pushes, pull requests, manual runs, and release calls.
It uses Ubuntu 24.04, Python 3.12, and Node.js 22 for the local and HTTP socket suites.
It also validates and packages the agent skill, uploading the tested ZIP for tag releases and manual runs.
Its **Documentation** job checks the whole repository with a floating mddt revision under the [documentation CI policy](documentation.md#continuous-integration).
The separate **Zotero integration** workflow runs manually and as a release requirement.

Tag pushes do not start a second standalone test run.
Superseded branch/PR test runs are cancelled; release runs are serialized per tag without cancelling an active release.
External actions use major version tags to receive compatible updates.

### Artifact flow

Tag releases require both workflows to pass on the triggering commit SHA.
The integration workflow builds the YAML/JSON once, verifies their action definitions in the actual app, and uploads those exact files.
Release preparation combines them with the tested skill ZIP from the same commit and renders the release body once.
The run summary shows that body and the asset sizes.
Publication consumes that prepared bundle without rebuilding or rendering again.

## Release preview

Manual release previews exercise the same verification and preparation as a tag release without publishing anything.

### Run and inspect

To prepare a preview:

1. Run **Build and Release** manually, selecting the branch and an intended `preview_tag` (default `v0.0.0-preview`).
1. After verification, inspect the body and asset sizes in the run summary.
1. Download `release-bundle-<commit SHA>` from the run artifacts and inspect its body and assets.

Manual runs execute the same tests and real Zotero verification as tag releases, using the intended tag for the backup version and release-body links.

### Preview artifacts and publication

The bundle contains `release-body.md`, `actions-zotero.yml`, `actions-zotero.json`, and `zot-jot.zip`, retained for seven days.
Preview links may not resolve until the tag and release exist.

Manual dispatch never creates a tag or GitHub Release, even when dispatched against an existing tag.
Only tag pushes run publication, using the body and assets prepared by that run.
The standalone **Test** workflow uploads the skill ZIP on manual runs without preparing the full release bundle.
