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

### Share Item (`shareItem.js`)

- **Purpose**: Shares an item to a predefined group library and collection
- **Context**: Available for items
- **Features**:
  - Copies the selected item, including attachments, to the specified group collection set by preferences.
  - After copying, it automatically triggers the `copySelectionLink` action on the newly created item in the group library.

### Retrieve Item (`retrieveItem.js`)

- **Purpose**: Moves an item to a selected collection in the user library.
- **Context**: Only works with items in share collection.
- **Features**:
  - Prompts the user to select a destination collection.
  - Moves the item by creating a copy in the new collection and erasing the original.

### Set Preferences (`setPreferences.js`)

- **Purpose**: Set the organization and user information in Zotero preferences.
- **Context**: Automatically triggered during the first restart after installation.
- **Features**:
  - If the preferences are not set, it prompts the user to set those.
  - Preferences are utilized by other actions such as *Review Note* or *Share Item*.

### Review Note (`reviewNote.js`)

- **Purpose**: Automatically adds a note to a newly created item if it belongs to a review collection.
- **Context**: This action is triggered automatically when a new item is created in Zotero. It is not intended for manual use.
- **Features**:
  - When a new regular item appears in the configured group's monitored collection, it adds a note with a formatted title (e.g., `YYMMDD ReviewerName`) and a selectable local review date.

### Update Actions (`updateActions.js`)

- **Purpose**: Automatically updates all actions from a specified GitHub repository release.
- **Context**: This action runs automatically when Zotero starts.
- **Features**:
  - Fetches the latest release from the `lee-lab-skku/zotero-actionstags-actions` repository.
  - Compares the latest version with the currently installed version.
  - If an update is available, it downloads and applies the new actions.

### Check VPN (`checkVPN.js`)

- **Purpose**: Checks whether the configured WebDAV server responds within five seconds.
- **Context**: Runs at startup and is available in the Tools menu.
- **Features**: Honors the configured HTTP/HTTPS scheme and reports network failures.
  A response only confirms reachability, not successful authentication or synchronization.

## Installation

1. Go to the [Releases](https://github.com/lee-lab-skku/zotero-actionstags-actions/releases) page
2. Download the YAML file.
3. In Zotero, go to Options → Actions and Tags
4. Click "Import" and select the downloaded file

## Project Structure

- **`src/`**: Contains the raw JavaScript files for each action.
- **`meta/`**: Contains the YAML definitions that describe the actions for the Actions & Tags plugin.
- **`build.py`**: A Python script that combines the files from `src/` and `meta/` into a single `zotero-actionstags-backup.yml` file for distribution.

## AI Disclosure

AI coding tools have assisted with API compatibility updates, code review, documentation, and regression tests.

## Credits

- Based on discussion and community contributions in the [zotero-actions-tags](https://github.com/windingwind/zotero-actions-tags) project
- Inspired by discussions in [zotero-actions-tags#115](https://github.com/windingwind/zotero-actions-tags/discussions/115)
