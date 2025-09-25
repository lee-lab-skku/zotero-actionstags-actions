# Zotero Actions & Tags Copy Link Scripts

*generated with Claude Sonnet 4--may fault*

This repository contains JavaScript actions for the [Zotero Actions & Tags](https://github.com/windingwind/zotero-actions-tags) plugin that provide two ways to copy links to Zotero items and annotations.

## Requirements

**Better BibTeX** must be installed. Make sure the citation key is pinned.

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
  - Respects current collection context

## Installation

1. Go to the [Releases](https://github.com/lee-lab-skku/zotero-actiontag-copylink/releases) page
2. Download `zotero-actiontag-copylink.yml`
3. In Zotero, go to Options → Actions and Tags
4. Click "Import" and select the downloaded YAML file

## Project Structure

```
├── src/
│   ├── copyAnnotationLink.js    # Annotation link script
│   └── copySelectionLink.js     # Selection link script
├── meta/
│   ├── copyAnnotationLink.yml   # YAML template for annotation link
│   └── copySelectionLink.yml    # YAML template for selection link
├── build.py                     # Python build script
├── README.md                    # This file
└── .github/workflows/           # GitHub Actions for releases
    └── release.yml
```

## Credits

- Based on discussion and community contributions in the [zotero-actions-tags](https://github.com/windingwind/zotero-actions-tags) project
- Inspired by discussions in [zotero-actions-tags#115](https://github.com/windingwind/zotero-actions-tags/discussions/115)