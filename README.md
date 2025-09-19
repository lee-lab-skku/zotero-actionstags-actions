# Zotero Actions & Tags Copy Link Scripts
*generated with Claude Sonnet 4*

This repository contains JavaScript actions for the [Zotero Actions & Tags](https://github.com/windingwind/zotero-actions-tags) plugin that provide various ways to copy links to Zotero items, annotations, and collections.

## Actions Included

### 1. Copy Annotation Link (`copyAnnotationLink.js`)
- **Purpose**: Creates a link to a specific annotation in a PDF
- **Context**: Available in the reader annotation menu
- **Features**: 
  - Generates `zotero://open-pdf` links
  - Includes page number and annotation position
  - Shows preview text from annotation
  - Includes citation key

### 2. Copy Selection Link (`copySelectionLink.js`)
- **Purpose**: Simple link to selected item with citation key
- **Context**: Available for items
- **Features**:
  - Uses citation key as link text
  - Respects current collection context
  - Quick and lightweight

## Installation

### Option 1: Download Pre-built YAML File
1. Go to the [Releases](https://github.com/lee-lab-skku/zotero-actiontag-copylink/releases) page
2. Download `zotero-actiontag-copylink.yml`
3. In Zotero, go to Tools → Actions and Tags
4. Click "Import" and select the downloaded YAML file

### Option 2: Build from Source
1. Clone this repository
2. Install Python dependencies (if needed): `pip install pyyaml`
3. Build YAML files: `python build.py`
4. Import the generated file from the `dist/` directory

## Development

### Project Structure
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

### Building
```bash
pip install pyyaml
python build.py
```

This will generate a combined YAML file in the `dist/` directory.

### Testing
The build script will automatically validate the YAML structure when building.

### Customization
1. Modify the JavaScript files in `src/` to change action behavior
2. Update the corresponding YAML template files in `meta/` to change action names, menus, or shortcuts
3. Run `python build.py` to regenerate the combined YAML file

### Creating Releases
1. Update version info as needed
2. Create and push a git tag: `git tag v1.0.0 && git push origin v1.0.0`
3. GitHub Actions will automatically build and create a release with the YAML file

## Configuration

The JavaScript actions can be customized by modifying the files in the `src/` directory. After making changes, run `python build.py` to regenerate the combined YAML file.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `python build.py`
5. Submit a pull request

## Credits

- Based on discussion and community contributions in the [zotero-actions-tags](https://github.com/windingwind/zotero-actions-tags) project
- Inspired by discussions in [zotero-actions-tags#115](https://github.com/windingwind/zotero-actions-tags/discussions/115)