# Zotero Actions & Tags actions

JavaScript actions for [Zotero Actions & Tags](https://github.com/windingwind/zotero-actions-tags) that copy links to library items, PDF annotations, and notes; automate review notes; change Delete behavior in collections; and check WebDAV connectivity.
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
1. Restart Zotero to load the startup actions and collection Delete behavior.
1. Follow the preference prompts to configure review notes and choose whether to include prereleases in update checks.
   Use **Tools &rightarrow; Configure action preferences** to change these settings later.

Use the YAML file for initial installation and the first upgrade to these Zotero 10 actions, especially if an older updater recorded a release without applying it.
The JSON file supports subsequent updates through [Update Actions](#updates).
For agent access, also follow [Agent link setup](#agent-link-setup); ordinary menu copying needs no bridge setup or agent skill.

### Upgrading older installations

When upgrading from a release containing **Share Item** and **Retrieve Item**, delete those two actions in Settings &rightarrow; Actions & Tags.
The updater adds or updates actions but does not remove actions absent from a release.

The obsolete `extensions.zotero.actionsTags.actions.shareCollectionKey` preference can be reset in Zotero's Advanced Config Editor.
Keep the group, review collection, and reviewer name preferences for Review Note.
Preference setup no longer imports `tara.groupID`; if that is your only organization setting, select your organization once when prompted.
Unused legacy preferences can remain without affecting these actions.

## Available actions

| Action | Where it runs | What it does |
| --- | --- | --- |
| Copy Selection Link | Item menu and PDF reader | Copies a `zotero://select` link with a citation key, title, or key as its label. |
| Copy Annotation Link | PDF reader annotation menu | Copies a `zotero://open-pdf` link with the annotation key, page number, and annotation preview. |
| Copy Note Link | Item menu for notes | Copies a Better Notes `zotero://note` link labeled with the note title and parent item's citation key when available. |
| Agent Link Bridge | Startup | Serves the copylink actions to authenticated local clients at `POST /action-links`. |
| Trash on Delete | Main-window load | Swaps Delete and Shift+Delete behavior in collection item lists. |
| Set Preferences | Startup and Tools menu | Configures review-note preferences and prerelease update checks. |
| Review Note | Item creation | Adds a dated reviewer note to new regular items in the configured group's monitored collection. |
| Update Actions | Startup and Tools menu | Offers newer releases from the installed source repository. |
| Check VPN | Startup and Tools menu | Checks whether the configured WebDAV server responds within five seconds. |

The backup also includes two disabled tag actions: **Add Unread When Create Item** and **Remove Unread When Close Tab**.
Enable them in Actions & Tags if you want to add `/unread` when an item is created and remove it when its tab closes.

### Copying links

Use the corresponding item, reader, or annotation menu command.
Copy Selection Link supports standalone attachments and avoids duplicate links when both a parent and its attachments are selected.
In the library tab, it preserves a single selected collection when the item belongs to it; multiple or mixed collection/search selections use library-level links.

Annotation previews show the first eight whitespace-separated words, preserving the spaces and line breaks between them.
They include `...` only when words are omitted; empty or whitespace-only annotations show only the citation key, title, or item key in parentheses.
Bridge clients can choose a different word range for each annotation; see the [API reference](skills/zot-jot/references/api.md#annotation-word-ranges).

Copy Note Link requires Better Notes.
Better BibTeX is optional for link copying.

### Collection Delete behavior

Trash on Delete handles regular items, notes, and attachments using Zotero's permission checks and normal trash confirmation.
It supports Undo and selections across multiple collections.

| In a collection's item list | Delete | Shift+Delete |
| --- | --- | --- |
| Action enabled | Move to library trash | Remove from collection; keep in library |
| Action disabled (Zotero defaults) | Remove from collection | Move to library trash |

In **Settings &rightarrow; Actions & Tags**, toggle **Enable** for **Move collection items to trash with Delete**.
Disabling takes effect immediately.
Enabling takes effect immediately if the action has already loaded in that window; otherwise, restart Zotero.
Leave the shortcut field empty because the action handles both keys directly.
Text editing, Ctrl/Alt/Meta combinations, other views, and annotation selections keep their usual behavior.

### Review notes and preferences

Set Preferences prompts for missing settings or a group or review collection that is no longer valid.
Review Note then adds a note to each new regular item in the configured group's monitored collection, with a title such as `YYMMDD ReviewerName` and a selectable local review date.
Review Note runs automatically and is not intended for manual dispatch.

### Updates

Update Actions checks at startup by default.
Use **Tools &rightarrow; Update custom actions**, or dispatch the action manually in Actions & Tags, to check again.
Clear its **Enable** checkbox to disable startup checks.

When newer allowed releases exist, a dialog lists them newest first, including intermediate releases, with **Not now** selected initially.
Cancelling changes nothing.
JSON releases can be applied after selection; YAML-only releases are labeled for manual import.
Drafts are excluded, and equal or older versions are never offered.
Local Git build IDs are displayed intact but compared using their base release tag.

Updates preserve existing Enable settings and shortcuts, including a disabled updater.
The complete backup is validated before any action is written, and the selected version is recorded only after all writes succeed.
A partial failure can leave earlier actions changed while retaining the old updater version for retry.
Updates do not remove actions absent from a release.

Set Preferences asks whether to include prereleases, defaulting to **No**.
The choice is stored in `extensions.zotero.actionsTags.actions.includePrereleases` and is not asked again at startup.
Change it through **Tools &rightarrow; Configure action preferences** or by manually dispatching Set Preferences.
Disabling prereleases does not downgrade an installed beta.
If the installed version is unknown, import a versioned YAML backup before using the updater.

Preference, update, and VPN menu commands run once for the selection.
Concurrent invocations of the same command are ignored until it finishes.

### WebDAV connectivity

Check VPN honors the configured HTTP/HTTPS scheme and reports network failures.
A response confirms server reachability; it does not verify authentication or synchronization.

## Agent link setup

The bridge returns the same links as the copylink menu actions without changing the clipboard or UI selection.
With known library and target identifiers, an authenticated HTTP client is sufficient; no dedicated Zotero CLI, MCP server, or Actions & Tags fork is required.

### Connect a client

1. Follow [Installation](#installation), importing Agent Link Bridge and all three copylink actions together.
1. Keep the bridge and required copylink actions enabled, then restart Zotero.
   Restart again after importing or re-enabling the bridge.
   During a manual trial, disable Update Actions so a published release cannot replace the trial scripts.
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
