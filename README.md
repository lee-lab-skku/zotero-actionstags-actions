# Zotero link actions

Zotero link actions copy links to library items, PDF annotations, and Better Notes notes from Zotero's menus.
They run as JavaScript actions in the [Actions & Tags](https://github.com/windingwind/zotero-actions-tags) plugin.
Agent Link Bridge serves the same links to local scripts and agents, and the bundled zot-jot skill guides agents through requesting and validating them.

## Requirements

The actions need Zotero and the following plugins:

- **Zotero 10** with a compatible version of **Actions & Tags**.
- **[Better Notes](https://github.com/windingwind/zotero-better-notes)** for Copy Note Link.
- **Better BibTeX** (optional) for citation keys in link labels; without it, labels fall back to item titles or keys.

Each release backup records the Zotero and Actions & Tags versions used for automated real-app verification, along with its UTC creation time.
Actions & Tags shows these values in its standard import details.
Those checks cover bridge and copylink behavior on that pair, not every action or optional plugin; see [verification scope](tests/integration/zotero/README.md#ci-verification) for details.

## Installation

Install and update the actions by importing the YAML backup:

1. Download `actions-zotero.yml` from [Releases](https://github.com/lee-lab-skku/zotero-link-actions/releases).
1. In Zotero, open **Settings &rightarrow; Actions & Tags**, click **Import**, and select the file.
1. Verify that Agent Link Bridge and the three copylink actions are enabled.
1. Restart Zotero to load Agent Link Bridge.

To update later, import the backup from the desired release and restart Zotero.
Menu copying works right after import; [agent access](#agent-access) needs further setup.

## Copying links

Each copylink action adds a menu command that copies a labeled link:

| Action | Menu | Copied link |
| --- | --- | --- |
| Copy Selection Link | Item menu and PDF reader | A `zotero://select` link labeled with the citation key, title, or item key. |
| Copy Annotation Link | PDF reader annotation menu | A `zotero://open-pdf` link with the annotation key, page, and annotation preview. |
| Copy Note Link | Item menu for notes | A Better Notes `zotero://note` link labeled with the note title and, when available, the parent item's citation key. |

Copy Selection Link supports standalone attachments and avoids duplicate links when both a parent and its attachments are selected.
In the library tab, it preserves a single selected collection when the item belongs to it; multiple or mixed collection and search selections use library-level links.

Annotation previews show the first eight whitespace-separated words, preserving the spaces and line breaks between them.
They include `...` only when words are omitted and display as `<preview> (<citation key, title, or item key>, p. <page>)`.
Empty or whitespace-only annotations, including area and image annotations, show `p. <page> (citation key, title, or item key)` instead.
The page uses Zotero's annotation page label when available, otherwise the one-based PDF page number.

## Agent access

Agent Link Bridge starts with Zotero and serves the copylink actions to authenticated local clients at `POST /action-links`.
It returns the same links as the menu commands without changing the clipboard or UI selection.
Bridge clients can also select [annotation word ranges](skills/zot-jot/references/api.md#annotation-word-ranges) or add [annotation prefixes](skills/zot-jot/references/api.md#annotation-prefixes) with an automatic separator.

[Agent link setup](docs/agent-links.md) covers profile authentication, client configuration, skill installation, and troubleshooting.
The installable [zot-jot skill](skills/zot-jot/SKILL.md) guides agents through target selection, requests, result validation, and failures.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) covers development setup, contribution requirements, and the action and distribution contracts.
[CHANGELOG.md](CHANGELOG.md) records release history.
The following guides cover building, testing, and releasing the actions:

- [Documentation](docs/README.md) covers client setup, upgrades, documentation changes, builds, and releases.
- [Test suites](tests/README.md) describes suite scope, local checks, coverage, and manual release checks.

## AI disclosure

AI coding tools have assisted with API compatibility updates, code review, documentation, and regression tests.

## Credits

Based on community discussions and contributions in [zotero-actions-tags](https://github.com/windingwind/zotero-actions-tags), including [discussion #115](https://github.com/windingwind/zotero-actions-tags/discussions/115).
