# Real Zotero integration verification

The fixture creates synthetic local items in an empty profile, installs the four bridge/copylink definitions, runs the real Actions & Tags startup script, and calls the real HTTP endpoint. It writes `link-bridge-report.json` in that profile and exits Zotero.

## CI verification

Run **Zotero integration** manually from GitHub Actions, selecting the branch to test.
The [workflow](../../../.github/workflows/zotero-integration.yml) is also required by tag releases and [manual release previews](../../../docs/releases.md#release-preview), alongside the regular test workflow.
It downloads the official Linux tarball and Actions & Tags XPI for one fixed pair: Zotero 10.0.6 and A&T 2.6.2.
It builds the selected commit's actions, starts Zotero under Xvfb with a fresh profile, and requires a successful fixture report, the expected installed versions, and a zero exit code within 120 seconds.
It does not run on ordinary pushes or PRs.

Real-app behavioral verification is a release requirement; the current automation is an initial, PoC-level implementation with the limited coverage below.
Passing it establishes only those checked behaviors on that app/plugin pair.
The remaining [manual release checks](../../README.md#manual-release-checks) still apply.

The build writes A&T's standard backup-root `platformVersion` (Zotero), `pluginVersion` (Actions & Tags), and `timestamp` (UTC creation time) fields into both YAML and JSON.
The runner requires equivalent backups and metadata matching the requested pair, then checks the actual runtime versions against that pair.
Only after success does the workflow upload `verified-backups-<commit SHA>`.
After both required workflows succeed, the release workflow bundles those exact files with the tested skill ZIP and rendered release body.
A manual release preview retains this bundle for inspection; a tag push publishes it without rebuilding.
The timestamp identifies file generation, before verification; it is neither the test completion time nor the publication time.

The fixture checks persisted action definitions and their actual startup event, real item/collection/annotation objects, parent deduplication, returned links and escaping, default and explicit annotation word ranges with applied metadata, authenticated localhost requests, error responses, and bridge replacement/disposal.
Better Notes is omitted from the current automated checks, so the missing-dependency response is checked.
YAML import dialogs, clipboard behavior, reader UI, Delete/Undo, shared libraries, sync, and other actions remain outside the current automated checks.

The artifact contains `report.json`, `expected-versions.json`, `zotero.log`, and `xvfb.log`, including reports/logs available after a failure.
The temporary profile and database are removed; profile preferences containing the trial token are never uploaded.
A missing report, timeout, failed assertion, version mismatch, or abnormal exit fails the workflow.

To run the same verification locally on Linux after downloading the fixed app/plugin pair:

```sh
python build.py --platform-version 10.0.6 --plugin-version 2.6.2
python tests/integration/zotero/run.py \
  --zotero /path/to/Zotero_linux-x86_64/zotero \
  --actions-tags-xpi /path/to/actions-and-tags-for-zotero.xpi \
  --expected-zotero 10.0.6 --expected-actions-tags 2.6.2 \
  --output /tmp/zotero-integration-results
```

Install `xvfb` and `xauth` first, and choose a new output directory for each run.
The official [Linux installation instructions](https://www.zotero.org/support/installation#linux) describe running the extracted app.
See the [Zotero version history](https://www.zotero.org/support/changelog) and [A&T 2.6.2 release](https://github.com/windingwind/zotero-actions-tags/releases/tag/v2.6.2) when updating the tested pair.

## Interactive disposable profile

Build the backup, download official Zotero 10-compatible Actions & Tags and optional Better Notes XPIs, then prepare a **new** profile:

```sh
python build.py
python tests/integration/zotero/prepare_profile.py \
  --profile /tmp/zotero-link-trial/profile \
  --actions-tags-xpi /path/to/actions-and-tags-for-zotero.xpi \
  --better-notes-xpi /path/to/better-notes-for-zotero.xpi
zotero -no-remote -profile /tmp/zotero-link-trial/profile
```

Omit `--better-notes-xpi` to test the missing-dependency error. The builder refuses existing profile/data directories, creates a separate sibling data directory, disables first-run browser guidance, automatic sync, and automatic app/plugin updates, uses port 23129, and installs only the bridge, copylinks, and test startup action. It does not enable Update Actions or the other actions in the backup.

For Windows Zotero from WSL, choose a new profile under `/mnt/c/...`; the builder converts its data directory to a Windows path. Launch `zotero.exe -no-remote -profile C:\...` using the printed native profile path. Do not select your existing Zotero profile. Close only the trial process if it stalls before writing its report.

The fixture never signs in, reads real profiles, or changes the clipboard. With Better Notes installed it tests actual note conversion; without it, it tests the missing-dependency response. Successful reports contain `ok: true` and the completed checks. Keep only the report when cleaning up; profile preferences contain the trial token.

This verifies server and dispatcher integration with real Zotero data objects. It does not replace manual YAML import/UI checks, opening returned URIs, or shared-library testing.
