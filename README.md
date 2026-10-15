# Zotero Actions & Tags actions

This repository contains some useful JavaScript actions for the [Zotero Actions & Tags](https://github.com/windingwind/zotero-actions-tags) plugin.

## Requirements

- **Zotero 10** and a Zotero 10-compatible version of **Actions & Tags**.
- **Better BibTeX** (Optional): Provides citation key generation; links fall back to the item title or key when no citation key is available.
- **Better Notes** (Optional): Required for the `copyNoteLink` action to function.

## Actions Included

### Copy Annotation Link (`copyAnnotationLink.js`)

- **Purpose**: Creates a link to a specific annotation in a PDF
- **Context**: Available in the Zotero PDF reader, annotation menu
- **Features**:
  - Generates `zotero://open-pdf` links
  - Includes page number and annotation key
  - Shows preview text from annotation
  - Includes citation key

### Copy Selection Link (`copySelectionLink.js`)

- **Purpose**: Simple link to selected item with citation key
- **Context**: Available in the item menu and PDF reader
- **Features**:
  - Generates `zotero://select` links
  - Uses citation key as link text
  - Respects a single selected collection in the library tab when the item belongs to it
  - Uses library-level links for multiple or mixed collection/search selections
  - Supports standalone attachments and avoids duplicate links for a parent and its attachments

### Copy Note Link (`copyNoteLink.js`)

- **Purpose**: Creates a link to a specific note created with the [Better Notes](https://github.com/windingwind/zotero-better-notes) plugin
- **Context**: Available for notes.
- **Features**:
  - Generates `zotero://note` links
  - Uses the note title and parent item's citation key for the link text

### Agent Link Bridge (`linkBridge.js`)

- **Purpose**: Returns selection, PDF annotation, and Better Notes links to local shell or agent clients.
- **Context**: Registers `POST /action-links` on Zotero's existing local HTTP server at startup.
- **Features**: Requires a profile-specific token, uses explicit item keys and library scope, and leaves the clipboard and UI selection untouched.

Import the updated copylink actions together with this action, then restart Zotero.
See [Agent link setup](#agent-link-setup) for pairing and the bundled agent skill.

### Trash on Delete (`trashOnDelete.js`)

- **Purpose**: Swaps Zotero's default Delete and Shift+Delete behavior in a collection's item list.
- **Context**: Automatically installed when each Zotero main window loads.
- **Features**:
  - Shows Zotero's normal trash confirmation and supports Undo, including selections across multiple collections.
  - Handles regular items, notes, and attachments using Zotero's permission checks.
  - Applies to Delete and Shift+Delete in the collection item list; text editing, Ctrl/Alt/Meta combinations, other views, and annotation selections retain their usual behavior.

| Actions & Tags Enable | Delete | Shift+Delete |
| --- | --- | --- |
| On | Move to library trash | Remove from collection; keep the item in the library |
| Off (Zotero defaults) | Remove from collection | Move to library trash |

After importing, restart Zotero to activate this action.
In Settings &rightarrow; Actions & Tags, use the **Enable** checkbox for **Move collection items to trash with Delete** to turn the swap on or off.
Disabling takes effect immediately; enabling takes effect immediately if the action was already loaded in this window, otherwise restart Zotero after enabling it.
Leave its shortcut field empty; the action handles both keys directly.

### Set Preferences (`setPreferences.js`)

- **Purpose**: Set the organization and user information in Zotero preferences.
- **Context**: Checks preferences each time Zotero starts.
- **Features**:
  - Prompts for missing settings or a group or review collection that is no longer valid.
  - Preferences are utilized by *Review Note*.

### Review Note (`reviewNote.js`)

- **Purpose**: Automatically adds a note to a newly created item if it belongs to a review collection.
- **Context**: This action is triggered automatically when a new item is created in Zotero. It is not intended for manual use.
- **Features**:
  - When a new regular item appears in the configured group's monitored collection, it adds a note with a formatted title (e.g., `YYMMDD ReviewerName`) and a selectable local review date.

### Update Actions (`updateActions.js`)

- **Purpose**: Check the installed source repository for newer releases and let the user choose one.
- **Context**: Enabled by default and checks for updates at startup.
  Dispatch it manually in Actions & Tags or use **Tools &rightarrow; Update custom actions** to check again.
  Clear its **Enable** checkbox in Settings &rightarrow; Actions & Tags to disable startup checks.
- **Features**:
  - Uses version and source constants embedded in the updater code at build time, so A&T editor saves retain them.
    Backup-root `version` and `repository` remain available for file inspection and validation; no custom action fields are required.
  - Shows a selection dialog only when an allowed release has a newer SemVer tag than the installed version.
  - Local Git build IDs are displayed intact, but comparison uses their base tag, ignoring commit distance, hash, and dirty state.
  - Lists all newer allowed releases, newest first, including intermediate releases. Drafts are excluded.
  - Starts with **Not now** selected; cancelling does not download or change actions.
  - Labels YAML-only releases for manual import. JSON releases can be applied after selection.
  - Validates the complete backup before writing, preserves enabled settings and shortcuts, and applies the updater last.
    If Update Actions was already disabled, updating it keeps it disabled.
  - Records the chosen tag only after all writes succeed. Partial failures can leave earlier actions changed, but retain the old updater version for retry.
  - Does not automatically remove actions absent from a release or downgrade a beta when prereleases are disabled.

**Set preferences** asks whether to include prereleases, with **No** as the first and default button.
The choice is saved at `extensions.zotero.actionsTags.actions.includePrereleases` and is not asked again at startup.
Use **Tools → Configure action preferences** or manually dispatch Set preferences to change it.
An unknown installed version requires a versioned YAML import before the updater can determine which releases are newer.

Global preference, update, and VPN menu commands run once for the selection; concurrent invocations of the same command are ignored until it finishes.

### Check VPN (`checkVPN.js`)

- **Purpose**: Checks whether the configured WebDAV server responds within five seconds.
- **Context**: Runs at startup and is available in the Tools menu.
- **Features**: Honors the configured HTTP/HTTPS scheme and reports network failures.
  A response only confirms reachability, not successful authentication or synchronization.

## Installation

1. Go to the [Releases](https://github.com/lee-lab-skku/zotero-actionstags-actions/releases) page
1. Download `actions-zotero.yml`.
1. In Zotero, open Settings &rightarrow; Actions & Tags.
1. Click "Import" and select the downloaded file.

For the first upgrade to these Zotero 10 actions, import the YAML manually, especially if an older updater already recorded a release without applying it.
The JSON file is intended for subsequent automatic updates.
Release backups record the Zotero and Actions & Tags versions used for automated real-app verification and their UTC creation time in the plugin’s standard import details.
The current automated checks cover bridge/copylink behavior on that pair; they do not establish full coverage of all actions or optional plugins.

When upgrading from a release with Share Item and Retrieve Item, delete those two actions in Settings &rightarrow; Actions & Tags.
The updater only adds or updates actions included in a release; it does not remove previously installed actions that are absent from the backup.
The obsolete `extensions.zotero.actionsTags.actions.shareCollectionKey` preference can also be reset in Zotero's Advanced Config Editor; current actions no longer use it.
Keep the group, review collection, and reviewer name preferences for Review Note.
Preference setup no longer imports `tara.groupID`; users with only that legacy setting must select their organization once.
An unused legacy preference can remain in the profile without affecting these actions.

## Agent link setup

The bridge lets a local shell or agent obtain the same item, PDF annotation, and Better Notes links as the copylink menu actions.
It leaves the clipboard and UI selection untouched and needs no Actions & Tags plugin fork.
With known library and target identifiers, an ordinary authenticated HTTP client is sufficient; no dedicated Zotero CLI or MCP server is required.
Ordinary menu copying does not require the bridge or the agent skill.
Better Notes is required for note links; Better BibTeX is optional, with link labels falling back to titles or keys.

1. Follow [Installation](#installation), importing the updated copylink actions together with Agent Link Bridge.
1. Keep Agent Link Bridge and the required copylink actions enabled, then restart Zotero.
   Restart again after importing or re-enabling the bridge.
   During a manual trial, disable Update Actions so a published release cannot replace the trial scripts.
1. In Zotero's Advanced Config Editor, verify `extensions.zotero.httpServer.enabled` is true.
   The usual address is `http://127.0.0.1:23119`; use the port in `extensions.zotero.httpServer.port` if different.
1. Find `extensions.zotero.actionsTags.actions.linkBridgeToken`, created once per profile at startup.
   Store its value in the client's private configuration or `ACTION_LINK_TOKEN` environment variable.
   Keep it out of shared documents, command output, and agent answers.
   The client must reach the Zotero instance and profile that owns this token.
1. For agent use, download `zot-jot.zip` from the same [release](https://github.com/lee-lab-skku/zotero-actionstags-actions/releases) as the action backup.
   Extract it and install the resulting `zot-jot/` directory in your agent's skill location, keeping `SKILL.md` and `references/` together.
   If your agent's installer accepts a ZIP directly, provide that file.
   You can also install the complete [`skills/zot-jot`](skills/zot-jot/SKILL.md) directory from a checkout of the matching release tag using an installer that supports repository subdirectories.
   Each release description provides both the ZIP download link and the skill-directory URL pinned to that release tag.
   For installers that accept GitHub directory URLs, provide the tagged directory URL instead of the ZIP download URL.
   Importing the action YAML does not install or update the agent skill; install the matching skill when upgrading the actions.

Restarting Zotero retains the token.
To rotate it, clear the token preference, restart Zotero, then update the client configuration.
Disabling Agent Link Bridge stops link requests.
If the connection is refused, check Zotero is running, the server setting and port, and the bridge's startup state.
An authentication failure usually means the client token does not match this profile.
If an old copylink action returns `MISSING_RESULT`, import the updated bridge and all three copylink actions together and restart.
For note failures, check Better Notes is installed and compatible.

The bundled [zot-jot skill](skills/zot-jot/SKILL.md) (Zotero &mdash; Jump, Open, Trace) owns the agent workflow.
Its [API reference](skills/zot-jot/references/api.md) covers direct shell requests, request/response fields, and detailed failures for human clients as well.

## Project Structure

- `src/`: Contains the raw JavaScript files for each action.
- `meta/`: Contains the YAML definitions that describe the actions for the Actions & Tags plugin.
- `skills/`: Bundled agent skills and their self-contained references.
- `build_skill.py`: Validates the action-link skill and builds `dist/zot-jot.zip`.
- `build.py`: Combines `src/` and `meta/` into `dist/actions-zotero.yml` for import and `dist/actions-zotero.json` for automatic updates.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development, testing, and compatibility notes.

## AI Disclosure

AI coding tools have assisted with API compatibility updates, code review, documentation, and regression tests.

## Credits

- Based on discussion and community contributions in the [zotero-actions-tags](https://github.com/windingwind/zotero-actions-tags) project
- Inspired by discussions in [zotero-actions-tags#115](https://github.com/windingwind/zotero-actions-tags/discussions/115)
