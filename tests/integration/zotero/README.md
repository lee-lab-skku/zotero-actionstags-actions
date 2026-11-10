# Real Zotero integration verification

This guide describes real-app verification of the bridge and copylink actions, its coverage limits, and how to run automated or interactive disposable profiles.

## CI verification

The fixture creates synthetic local items in an empty profile, installs the four bridge/copylink definitions, runs the real Actions & Tags startup script, and calls the real HTTP endpoint.
It writes `link-bridge-report.json` in that profile and exits Zotero.

The [workflow](../../../.github/workflows/zotero-integration.yml) is required by tag releases and [manual release previews](../../../docs/releases.md#release-preview), alongside the regular test workflow.
It downloads the official Linux tarball and Actions & Tags XPI for one fixed pair: Zotero 10.0.6 and A&T 2.6.2.
It builds the selected commit's actions, starts Zotero under Xvfb with a fresh profile, and requires a successful fixture report, the expected installed versions, and a zero exit code within 120 seconds.
It does not run on ordinary pushes or PRs.

### Coverage and limitations

Real-app behavioral verification is a release requirement; the current automation is an initial, PoC-level implementation with the limited coverage described here.
Passing it establishes only those checked behaviors on that app/plugin pair.
The remaining [manual release checks](../../README.md#manual-release-checks) still apply.

The fixture checks these behaviors:

- **Action loading**: Persisted action definitions and their actual startup event.
- **Data and links**: Real item/collection/annotation objects, parent deduplication, returned links, and escaping.
- **Annotation ranges**: Default and explicit word ranges with applied metadata.
- **HTTP and lifecycle**: Authenticated localhost requests, error responses, and bridge replacement/disposal.

Better Notes is omitted from the current automated checks, so the missing-dependency response is checked.
YAML import dialogs, clipboard behavior, reader UI, shared libraries, sync, and Better Notes conversion remain outside the current automated checks.

### Artifacts and failures

The build records A&T's standard backup-root fields in the YAML backup:

| Field | Meaning |
| --- | --- |
| `platformVersion` | Zotero version being verified |
| `pluginVersion` | Actions & Tags version being verified |
| `timestamp` | UTC file creation time, before verification; neither test completion time nor publication time |

The runner requires backup metadata matching the requested pair, then checks the actual runtime versions against that pair.
A missing report, timeout, failed assertion, version mismatch, or abnormal exit fails the workflow.
The workflows retain these distinct artifacts:

| Artifact | Contents | Upload condition |
| --- | --- | --- |
| `zotero-integration-<commit SHA>` | `report.json`, `expected-versions.json`, `zotero.log`, and `xvfb.log` | Uploads available reports and logs even after failure. |
| `verified-backups-<commit SHA>` | The verified YAML backup | Uploads only after successful integration verification. |
| `release-bundle-<commit SHA>` | That exact backup, the tested skill ZIP, and the rendered release body | Prepared after both required workflows succeed; retained for manual preview or published on a tag push without rebuilding. |

The temporary profile and database are removed; profile preferences containing the trial token are never uploaded.

## Running automated verification

Run the fixed app/plugin verification in CI or on a Linux machine with the required runtime dependencies.

### Run in CI

Run **Zotero integration** manually from GitHub Actions, selecting the branch to test.
Tag releases and [manual release previews](../../../docs/releases.md#release-preview) also require this verification.
Inspect the run's report and logs using the [artifact and failure contract](#artifacts-and-failures).

### Run locally

Before running locally on Linux, download the fixed app/plugin pair, install `xvfb` and `xauth`, and choose a new output directory.
Then build the backup and run verification, replacing the example paths with your local paths:

```sh
python build.py --platform-version 10.0.6 --plugin-version 2.6.2
python tests/integration/zotero/run.py \
  --zotero /path/to/Zotero_linux-x86_64/zotero \
  --actions-tags-xpi /path/to/actions-and-tags-for-zotero.xpi \
  --expected-zotero 10.0.6 --expected-actions-tags 2.6.2 \
  --output /tmp/zotero-integration-results
```

The official [Linux installation instructions](https://www.zotero.org/support/installation#linux) describe running the extracted app.
See the [Zotero version history](https://www.zotero.org/support/changelog) and [A&T 2.6.2 release](https://github.com/windingwind/zotero-actions-tags/releases/tag/v2.6.2) when updating the tested pair.

## Interactive disposable profile

Use a new disposable profile to inspect bridge behavior with Actions & Tags and optional Better Notes installed.

### Prepare and launch

Build the backup, download official Zotero 10-compatible Actions & Tags and optional Better Notes XPIs, then prepare a **new** profile:

```sh
python build.py
python tests/integration/zotero/prepare_profile.py \
  --profile /tmp/zotero-link-trial/profile \
  --actions-tags-xpi /path/to/actions-and-tags-for-zotero.xpi \
  --better-notes-xpi /path/to/better-notes-for-zotero.xpi
zotero -no-remote -profile /tmp/zotero-link-trial/profile
```

Omit `--better-notes-xpi` to test the missing-dependency error.
The builder prepares the disposable environment with these settings:

- **Storage**: It refuses existing profile/data directories and creates a separate sibling data directory.
- **Automatic activity**: It disables first-run browser guidance, automatic sync, and automatic app/plugin updates.
- **Server**: It uses port 23129.
- **Actions**: It installs only the bridge, copylinks, and test startup action.

### Windows and WSL

For Windows Zotero from WSL, choose a new profile under `/mnt/c/...`; the builder converts its data directory to a Windows path.
Launch `zotero.exe -no-remote -profile C:\...` using the printed native profile path.
Do not select your existing Zotero profile.
Close only the trial process if it stalls before writing its report.

### Results and cleanup

The fixture never signs in, reads real profiles, or changes the clipboard.
With Better Notes installed it tests actual note conversion; without it, it tests the missing-dependency response.
Successful reports contain `ok: true` and the completed checks.
Keep only the report when cleaning up; profile preferences contain the trial token.

This verifies server and dispatcher integration with real Zotero data objects.
It does not replace manual YAML import/UI checks, opening returned URIs, or shared-library testing.
