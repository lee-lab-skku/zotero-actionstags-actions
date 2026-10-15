# Release workflow

Follow the [release requirements](../CONTRIBUTING.md#release-requirements) and complete the [manual release checks](../tests/README.md#manual-release-checks) before publishing.
See [building distributable files](building.md) for build options and artifact metadata.

## CI workflows

The **Test** workflow runs the local and HTTP socket suites on Ubuntu 24.04 with Python 3.12 and Node.js 22 for branch pushes, pull requests, and manual runs.
It also validates and packages the agent skill, uploading the tested ZIP for tag releases and manual runs.
The separate **Zotero integration** workflow runs manually and as a release requirement.

Tag releases require both workflows to pass on the triggering commit SHA.
The integration workflow builds the YAML/JSON once, verifies their action definitions in the actual app, and uploads those exact files.
Release preparation combines them with the tested skill ZIP from the same commit, renders the release body once, and shows the body and asset sizes in the run summary.
Publication consumes that prepared bundle without rebuilding or rendering again.

Tag pushes do not start a second standalone test run.
Superseded branch/PR test runs are cancelled; release runs are serialized per tag without cancelling an active release.
External actions use major version tags to receive compatible updates.

## Release preview

Run **Build and Release** manually, selecting the branch and an intended `preview_tag` (default `v0.0.0-preview`).
Manual runs execute the same tests and real Zotero verification as tag releases, using the intended tag for the backup version and release-body links.

After verification, inspect the body and asset sizes in the run summary and download `release-bundle-<commit SHA>` from the run artifacts.
The bundle contains `release-body.md`, `actions-zotero.yml`, `actions-zotero.json`, and `zot-jot.zip`, retained for seven days.
Preview links may not resolve until the tag and release exist.

Manual dispatch never creates a tag or GitHub Release, even when dispatched against an existing tag.
Only tag pushes run publication, using the body and assets prepared by that run.
The standalone **Test** workflow uploads the skill ZIP on manual runs without preparing the full release bundle.
