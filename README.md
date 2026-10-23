# Zotero Actions & Tags actions

JavaScript actions for [Zotero Actions & Tags](https://github.com/windingwind/zotero-actions-tags) that copy links to library items, PDF annotations, and notes.
A local link bridge also makes the copylink actions available to shell and agent clients.

## Requirements

- **Zotero 10** with a compatible version of **Actions & Tags**.
- **Better BibTeX** (optional) for citation keys in link labels; labels fall back to item titles or keys when no citation key is available.
- **[Better Notes](https://github.com/windingwind/zotero-better-notes)** for Copy Note Link.

Release backups show the Zotero and Actions & Tags versions used for automated real-app verification, along with their UTC creation time, in the plugin's standard import details.
Those checks cover bridge/copylink behavior on that pair, rather than every action or optional plugin.
See [verification scope](tests/integration/zotero/README.md#ci-verification) for details.

## Installation

1. Download `actions-zotero.yml` from [Releases](https://github.com/lee-lab-skku/zotero-actionstags-actions/releases).
1. In Zotero, open **Settings &rightarrow; Actions & Tags**, click **Import**, and select the file.
1. Restart Zotero to load Agent Link Bridge.

To update later, download and import the YAML backup from the desired release, then restart Zotero.
The release also includes an equivalent JSON backup for tools that consume JSON.
For agent access, also follow [Agent link setup](#agent-link-setup); ordinary menu copying needs no bridge setup or agent skill.

### Upgrading older installations

This distribution now contains only the three copylink actions and Agent Link Bridge.
Before upgrading, export your installed Actions & Tags definitions as a backup and disable any old **Update Actions** action.
Importing this backup does not remove actions already installed in your profile.

In **Settings &rightarrow; Actions & Tags**, remove the following legacy actions if installed:

- **Update Actions**, **Set Preferences**, **Review Note**, **Trash on Delete** (named **Move collection items to trash with Delete**), and **Check VPN**.
- **Add Unread When Create Item** and **Remove Unread When Close Tab**.
- **Share Item** and **Retrieve Item** from older releases.

Restart Zotero after removing the legacy actions so their previously loaded listeners and menu handlers are unloaded.
Legacy preference values can remain; the copylink actions do not use the old group, review, sharing, reviewer, or update settings.
Keep the bridge token and HTTP server settings described below.

The v2.6.0 updater was disabled by default; users who enabled it must disable or remove their installed copy to stop it from applying future release backups.
Omitting it from this distribution does not disable it in an existing profile.

## Available actions

| Action | Where it runs | What it does |
| --- | --- | --- |
| Copy Selection Link | Item menu and PDF reader | Copies a `zotero://select` link with a citation key, title, or key as its label. |
| Copy Annotation Link | PDF reader annotation menu | Copies a `zotero://open-pdf` link with the annotation key, page number, and annotation preview. |
| Copy Note Link | Item menu for notes | Copies a Better Notes `zotero://note` link labeled with the note title and parent item's citation key when available. |
| Agent Link Bridge | Startup | Serves the copylink actions to authenticated local clients at `POST /action-links`. |

### Copying links

Use the corresponding item, reader, or annotation menu command.
Copy Selection Link supports standalone attachments and avoids duplicate links when both a parent and its attachments are selected.
In the library tab, it preserves a single selected collection when the item belongs to it; multiple or mixed collection/search selections use library-level links.

Annotation previews show the first eight whitespace-separated words, preserving the spaces and line breaks between them.
They include `...` only when words are omitted; empty or whitespace-only annotations, including area/image annotations, show `p. <page> (citation key, title, or item key)` instead.
The page uses Zotero's annotation page label when available, otherwise the one-based PDF page number.
Bridge clients can choose a different word range or prepend custom text with an automatic separator for each annotation; see the [API reference](skills/zot-jot/references/api.md#annotation-prefixes).

Copy Note Link requires Better Notes.
Better BibTeX is optional for link copying.

## Agent link setup

The bridge returns the same links as the copylink menu actions without changing the clipboard or UI selection.
With known library and target identifiers, an authenticated HTTP client is sufficient; no dedicated Zotero CLI, MCP server, or Actions & Tags fork is required.

### Connect a client

1. Follow [Installation](#installation), importing Agent Link Bridge and all three copylink actions together.
1. Keep the bridge and required copylink actions enabled, then restart Zotero.
   Restart again after importing or re-enabling the bridge.
1. In Zotero's Advanced Config Editor, verify that `extensions.zotero.httpServer.enabled` is true.
   The usual address is `http://127.0.0.1:23119`; use the port in `extensions.zotero.httpServer.port` if different.
1. Read `extensions.zotero.actionsTags.actions.linkBridgeToken`, created once per profile at startup.
   Store its value in the client's private configuration or `ACTION_LINK_TOKEN` environment variable.
   Keep it out of shared documents, command output, and agent answers.
   The client must reach the Zotero instance and profile that owns this token.

The token survives restarts.
To rotate it, clear the token preference, restart Zotero, and update the client configuration.
Disabling Agent Link Bridge stops link requests.

### Install the agent skill

Download `zot-jot.zip` from the same [release](https://github.com/lee-lab-skku/zotero-actionstags-actions/releases) as the action backup.
Extract it and install the complete `zot-jot/` directory in your agent's skill location, keeping `SKILL.md` and `references/` together.
If your installer accepts a ZIP directly, provide that file.

Alternatively, install the complete [`skills/zot-jot`](skills/zot-jot/SKILL.md) directory from a checkout of the matching release tag.
Each release description links both the ZIP and the skill directory pinned to that tag.
For installers that accept GitHub directory URLs, use the tagged directory link.
Importing or updating Zotero actions does not install or update the skill; install the matching skill separately when upgrading.

The [zot-jot skill](skills/zot-jot/SKILL.md) (Zotero &mdash; Jump, Open, Trace) describes the agent workflow.
Its [API reference](skills/zot-jot/references/api.md) covers direct shell requests, request/response fields, and detailed errors for all clients.
Better Notes is required for note links; Better BibTeX is optional.

### Troubleshooting

| Symptom | Check |
| --- | --- |
| Connection refused | Zotero is running, the HTTP server is enabled, the port is correct, and the bridge loaded at startup. |
| Authentication failure | The client token belongs to the connected Zotero profile. |
| `MISSING_RESULT` from an old copylink action | Import the updated bridge and all three copylink actions together, then restart Zotero. |
| Note-link failure | Better Notes is installed and compatible. |

## Development

Action scripts live in `src/`, plugin definitions in `meta/`, and the bundled agent skill in `skills/`.
`build.py` creates the YAML and JSON backups; `build_skill.py` packages the skill ZIP.
Generated assets go in `dist/`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, action contracts, testing, and releases, and [CHANGELOG.md](CHANGELOG.md) for release history.

## AI disclosure

AI coding tools have assisted with API compatibility updates, code review, documentation, and regression tests.

## Credits

Based on community discussions and contributions in [zotero-actions-tags](https://github.com/windingwind/zotero-actions-tags), including [discussion #115](https://github.com/windingwind/zotero-actions-tags/discussions/115).
