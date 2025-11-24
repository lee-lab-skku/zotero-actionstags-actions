# Zotero Actions & Tags backup actions

This repository contains some useful JavaScript actions for the [Zotero Actions & Tags](https://github.com/windingwind/zotero-actions-tags) plugin.

## Requirements

- **Better BibTeX**: Must be installed for citation key generation.
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
  - Respects current collection context, if called in the main tab

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
  - Copies the selected item, including attachments, to a hardcoded `[LeeLab]` → `Temporary Share`
  - After copying, it automatically triggers the `copySelectionLink` action on the newly created item in the group library

### Retrieve Item (`retrieveItem.js`)

- **Purpose**: Moves an item to a selected collection in the user library
- **Context**: Recommended for items in `[LeeLab]` → `Temporary Share`
- **Features**:
  - Prompts the user to select a destination collection
  - Moves the item by creating a copy in the new collection and deleting the original

## Installation

1. Go to the [Releases](https://github.com/lee-lab-skku/zotero-actiontag-copylink/releases) page
2. Download the YAML file.
3. In Zotero, go to Options → Actions and Tags
4. Click "Import" and select the downloaded file

## Project Structure

- **`src/`**: Contains the raw JavaScript files for each action.
- **`meta/`**: Contains the YAML definitions that describe the actions for the Actions & Tags plugin.
- **`build.py`**: A Python script that combines the files from `src/` and `meta/` into a single `zotero-actionstags-backup.yml` file for distribution.

## Credits

- Based on discussion and community contributions in the [zotero-actions-tags](https://github.com/windingwind/zotero-actions-tags) project
- Inspired by discussions in [zotero-actions-tags#115](https://github.com/windingwind/zotero-actions-tags/discussions/115)
