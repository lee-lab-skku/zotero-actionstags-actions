# Disposable Zotero profile test

The fixture creates synthetic local items in an empty profile, installs the four bridge/copylink definitions, runs the real Actions & Tags startup script, and calls the real HTTP endpoint. It writes `link-bridge-report.json` in that profile and exits Zotero.

Build the backup, download official Zotero 10-compatible Actions & Tags and optional Better Notes XPIs, then prepare a **new** profile:

```sh
python build.py
python tests/integration/zotero/prepare_profile.py \
  --profile /tmp/zotero-link-trial/profile \
  --actions-tags-xpi /path/to/actions-and-tags-for-zotero.xpi \
  --better-notes-xpi /path/to/better-notes-for-zotero.xpi
zotero -no-remote -profile /tmp/zotero-link-trial/profile
```

Omit `--better-notes-xpi` to test the missing-dependency error. The builder refuses existing profile/data directories, creates a separate sibling data directory, disables automatic sync and plugin updates, uses port 23129, and installs only the bridge, copylinks, and test startup action. It does not enable Update Actions or the other actions in the backup.

For Windows Zotero from WSL, choose a new profile under `/mnt/c/...`; the builder converts its data directory to a Windows path. Launch `zotero.exe -no-remote -profile C:\...` using the printed native profile path. Do not select your existing Zotero profile. Close only the trial process if it stalls before writing its report.

The fixture never signs in, reads real profiles, or changes the clipboard. With Better Notes installed it tests actual note conversion; without it, it tests the missing-dependency response. Successful reports contain `ok: true` and the completed checks. Keep only the report when cleaning up; profile preferences contain the trial token.

This verifies server and dispatcher integration with real Zotero data objects. It does not replace manual YAML import/UI checks, opening returned URIs, or shared-library testing.
