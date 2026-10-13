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
  - Includes page number and annotation position
  - Shows preview text from annotation
  - Includes citation key

### Copy Selection Link (`copySelectionLink.js`)

- **Purpose**: Simple link to selected item with citation key
- **Context**: Available for items
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
See [Local link API](docs/action-links.md) for pairing, requests, responses, and troubleshooting.

### Trash on Delete (`trashOnDelete.js`)

- **Purpose**: Moves selected items to the library trash when pressing Delete in a collection's item list.
- **Context**: Automatically installed when each Zotero main window loads.
- **Features**:
  - Shows Zotero's normal trash confirmation and supports Undo, including selections across multiple collections.
  - Handles regular items, notes, and attachments using Zotero's permission checks.
  - Applies only to plain Delete in the collection item list; text editing, modified keys, other views, and annotation selections retain their usual behavior.
  - Disable this action in Actions & Tags to restore the usual collection removal behavior immediately.

After importing, restart Zotero to activate this action.
Leave its shortcut field empty; the action handles Delete directly to prevent simultaneous collection removal.

### Set Preferences (`setPreferences.js`)

- **Purpose**: Set the organization and user information in Zotero preferences.
- **Context**: Automatically triggered during the first restart after installation.
- **Features**:
  - If the preferences are not set, it prompts the user to set those.
  - Preferences are utilized by *Review Note*.

### Review Note (`reviewNote.js`)

- **Purpose**: Automatically adds a note to a newly created item if it belongs to a review collection.
- **Context**: This action is triggered automatically when a new item is created in Zotero. It is not intended for manual use.
- **Features**:
  - When a new regular item appears in the configured group's monitored collection, it adds a note with a formatted title (e.g., `YYMMDD ReviewerName`) and a selectable local review date.

### Update Actions (`updateActions.js`)

- **Purpose**: Automatically updates all actions from a specified GitHub repository release.
- **Context**: Disabled by default; when enabled, this action runs when Zotero starts.
- **Features**:
  - Fetches the latest release from the `lee-lab-skku/zotero-actionstags-actions` repository.
  - Compares the latest version with the currently installed version.
  - If an update is available, it downloads and applies the new actions.
  - Uses the release's `actions-zotero.json` asset and records the version only after all updates succeed.
  - Preserves existing enabled/disabled settings and shortcuts; other action code and metadata are replaced.
  - If an update partially fails, the next run retries it.

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

When upgrading from a release with Share Item and Retrieve Item, delete those two actions in Settings &rightarrow; Actions & Tags.
The updater only adds or updates actions included in a release; it does not remove previously installed actions that are absent from the backup.
The obsolete `extensions.zotero.actionsTags.actions.shareCollectionKey` preference can also be reset in Zotero's Advanced Config Editor; current actions no longer use it.
Keep the group, review collection, and reviewer name preferences for Review Note.
Preference setup no longer imports `tara.groupID`; users with only that legacy setting must select their organization once.
An unused legacy preference can remain in the profile without affecting these actions.

## Project Structure

- **`src/`**: Contains the raw JavaScript files for each action.
- **`meta/`**: Contains the YAML definitions that describe the actions for the Actions & Tags plugin.
- **`build.py`**: Combines `src/` and `meta/` into `dist/actions-zotero.yml` for import and `dist/actions-zotero.json` for automatic updates.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development, testing, and compatibility notes.

## AI Disclosure

AI coding tools have assisted with API compatibility updates, code review, documentation, and regression tests.

## Credits

- Based on discussion and community contributions in the [zotero-actions-tags](https://github.com/windingwind/zotero-actions-tags) project
- Inspired by discussions in [zotero-actions-tags#115](https://github.com/windingwind/zotero-actions-tags/discussions/115)
