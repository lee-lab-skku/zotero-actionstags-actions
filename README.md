# Zotero Actions & Tags actions

JavaScript actions for [Zotero Actions & Tags](https://github.com/windingwind/zotero-actions-tags) that copy links to library items, PDF annotations, and notes.
A local link bridge also makes the copylink actions available to shell and agent clients.

## Requirements

Install Zotero and the plugins needed for the actions you use:

- **Zotero 10** with a compatible version of **Actions & Tags**.
- **Better BibTeX** (optional) for citation keys in link labels; labels fall back to item titles or keys when no citation key is available.
- **[Better Notes](https://github.com/windingwind/zotero-better-notes)** for Copy Note Link.

Release backups show the Zotero and Actions & Tags versions used for automated real-app verification, along with their UTC creation time, in the plugin's standard import details.
Those checks cover bridge/copylink behavior on that pair, rather than every action or optional plugin.
See [verification scope](tests/integration/zotero/README.md#ci-verification) for details.

## Installation

Use the YAML backup for installation and updates:

1. Download `actions-zotero.yml` from [Releases](https://github.com/lee-lab-skku/zotero-actionstags-actions/releases).
1. In Zotero, open **Settings &rightarrow; Actions & Tags**, click **Import**, and select the file.
1. Verify that Agent Link Bridge and the three copylink actions are enabled.
1. Restart Zotero to load Agent Link Bridge.

To update later, download and import the YAML backup from the desired release, then restart Zotero.
For agent access, also follow [Agent link setup](docs/agent-links.md); ordinary menu copying needs no bridge setup or agent skill.

## Available actions

The actions below provide link copying and an agent bridge.

| Action | Where it runs | What it does |
| --- | --- | --- |
| Copy Selection Link | Item menu and PDF reader | Copies a `zotero://select` link with a citation key, title, or key as its label. |
| Copy Annotation Link | PDF reader annotation menu | Copies a `zotero://open-pdf` link with the annotation key, page number, and annotation preview. |
| Copy Note Link | Item menu for notes | Copies a Better Notes `zotero://note` link labeled with the note title and parent item's citation key when available. |
| Agent Link Bridge | Startup | Serves the copylink actions to authenticated local clients at `POST /action-links`. |

## Copying links

Use the corresponding item, reader, or annotation menu command.
Copy Selection Link supports standalone attachments and avoids duplicate links when both a parent and its attachments are selected.
In the library tab, it preserves a single selected collection when the item belongs to it; multiple or mixed collection/search selections use library-level links.

Annotation previews show the first eight whitespace-separated words, preserving the spaces and line breaks between them.
They include `...` only when words are omitted and display as `<preview> (<citation key, title, or item key>, p. <page>)`; empty or whitespace-only annotations, including area/image annotations, show `p. <page> (citation key, title, or item key)` instead.
The page uses Zotero's annotation page label when available, otherwise the one-based PDF page number.
Bridge clients can select [annotation word ranges](skills/zot-jot/references/api.md#annotation-word-ranges) or add [annotation prefixes](skills/zot-jot/references/api.md#annotation-prefixes) with an automatic separator.

Copy Note Link requires Better Notes.
Better BibTeX is optional for link copying.

## Agent link setup

The bridge returns the same links as the copylink menu actions without changing the clipboard or UI selection.
[Agent link setup](docs/agent-links.md) covers profile authentication, client configuration, skill installation, and troubleshooting.
The installable [zot-jot skill](skills/zot-jot/SKILL.md) guides agents through target selection, requests, result validation, and failures.

## Contributing

Action scripts live in `src/`, plugin definitions in `meta/`, and the bundled agent skill in `skills/`.
`build.py` creates the YAML backup; `build_skill.py` packages the skill ZIP.
Generated assets go in `dist/`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution requirements, and [CHANGELOG.md](CHANGELOG.md) for release history.
The following guides cover building, testing, and releasing the actions:

- [Documentation](docs/README.md) covers client setup, upgrades, documentation changes, builds, and releases.
- [Test suites](tests/README.md) describes suite scope, local checks, coverage, and manual release checks.

## AI disclosure

AI coding tools have assisted with API compatibility updates, code review, documentation, and regression tests.

## Credits

Based on community discussions and contributions in [zotero-actions-tags](https://github.com/windingwind/zotero-actions-tags), including [discussion #115](https://github.com/windingwind/zotero-actions-tags/discussions/115).
