<!-- markdownlint-disable MD024 -->
# Changelog

Notable changes are recorded in the style of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
For this changelog, `withdrawl` at commit `80b729a` is the initial baseline, without a release date; earlier versions are intentionally omitted.
Version `2.4.0` describes changes from that baseline, and each later version describes changes from the preceding listed version.
Dates use GitHub release publication dates where available; `2.4.0` and `2.4.1` use their tagged commit dates because no corresponding GitHub releases are currently listed.

## [Unreleased]

## [3.0.0-beta.1] - 2026-09-10

### Added

- JSON release backups for automatic updates, alongside the YAML import file.
- Regression tests and CI for action behavior and backup generation.
- Contributor documentation covering compatibility, validation, and manual Zotero testing.
- Prerelease-aware publishing for version tags with a prerelease suffix.

### Changed

- **Breaking:** Require Zotero 10 and a compatible Actions & Tags plugin; earlier Zotero versions are no longer supported.
- **Breaking:** Copy one selection link per resolved item instead of one per selected row, deduplicating parent and attachment selections.
  Include a collection path only when the collection context is unambiguous and the item belongs to it.
- Fall back to item titles or keys when citation keys are unavailable.
- Preserve tags, child notes, embedded images, attachments, and Zotero annotations when sharing or retrieving items.
  Linked files are imported as stored attachments, and URL attachments are retained.
- **Breaking:** Limit sharing and retrieval to regular, non-trashed items in a different library from the destination; same-library copying is rejected.
- **Breaking:** Require destination write permissions and all attachment files and note images to be locally available before copying; incomplete copies are no longer attempted.
- **Breaking:** Move retrieved source items to the group library trash only after a successful copy, instead of permanently erasing them.
  Zotero 10 Undo can restore the source without removing the destination copy.
- **Breaking:** Require an `actions-zotero.json` release asset for automatic updates; YAML-only releases remain manually importable.
  Import the YAML manually for the initial upgrade to this updater.
- Preserve existing enabled settings and shortcuts during automatic updates.
- Validate the entire release backup before updating any actions.
- **Breaking:** Reject script actions with missing source files and action metadata without an explicit integer event or string data during the build.
- Resolve build paths relative to the build script so it can run from another working directory.

### Fixed

- Handle standalone attachments and empty selections when copying links.
- Validate PDF annotation positions and escape user text in HTML links and review notes.
- Dispatch the copied item's selection link correctly after sharing.
- Retain and migrate the configured group ID, handle missing groups and collections, and validate reviewer names.
- Restrict review notes and retrieval to the configured group and collection; format review dates using the local calendar.
- Honor the configured WebDAV HTTP/HTTPS scheme and report connection failures as well as timeouts.
- Record the installed version only after all updates succeed, allowing failed updates to be retried.
- Explicitly declare the retrieval action's menu-only event.

### Removed

- Downloading and evaluating an external YAML parser during automatic updates.

## [2.6.0] - 2026-06-15

### Added

- A WebDAV reachability check at startup and in the Tools menu, warning when the server does not respond within five seconds.

## [2.5.1] - 2026-06-15

### Fixed

- PDF annotation links now identify the parent attachment in the item path and the annotation in the query, fixing links that failed to open the PDF.

## [2.5.0] - 2026-01-07

### Added

- Copy selection links for multiple items in one operation, using newline-separated plain URLs and separate HTML links.

### Changed

- Generate selection links once for the whole selection, resolving child attachments to their parent items.

## [2.4.3] - 2026-01-07

### Added

- A lookup of the legacy `tara.groupID` preference during organization setup.

### Changed

- Disable automatic action updates by default.
- Update action descriptions to explain shared preference setup and the configured share collection.

## [2.4.2] - 2025-12-01

### Changed

- Extend the selectable review dates from today through seven days ahead to today through fourteen days ahead.

## [2.4.1] - 2025-12-01

### Fixed

- Cancel preference dialogs without returning a numeric status as an action message.

## [2.4.0] - 2025-12-01

### Added

- A startup action to configure the organization, review collection, share collection, and reviewer name in one place.
- Update summaries distinguishing new, updated, and unchanged actions.

### Changed

- Store shared settings under `actionsTags.actions.*` and use configured destinations for sharing and review notes instead of per-action setup or hardcoded sharing targets.
- Restrict retrieval to items belonging to the configured share collection.
- Rename the generated backup to `actions-zotero.yml` and discover update assets by their `.yml` extension.
- Initialize the automatic updater's version on its first run without applying an update, and skip unchanged action definitions on later updates.
- Return readable completion messages from retrieval and review actions.

### Fixed

- Handle Actions & Tags' selection-level and per-item invocations explicitly, and run asynchronous sharing, retrieval, and review work in the action's own async context.
- Distinguish a non-note selection from a missing Better Notes plugin when copying note links.

### Removed

- The automatic updater's Tools menu entry.

## [withdrawl]

### Added

- The initial action collection for copying Zotero item links, PDF annotation links, and Better Notes links with citation-key labels.
- Group sharing and retrieval actions, including attachment copying, and review notes with reviewer names and selectable dates.
- Automatic action updates from GitHub releases, also available from the Tools menu.
- YAML backup generation and tag-triggered release builds.
- Optional `/unread` tagging actions, disabled by default.

[Unreleased]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/v3.0.0-beta.1...main
[3.0.0-beta.1]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/e339b8d...v3.0.0-beta.1
[2.6.0]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/d5f0577...e339b8d
[2.5.1]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/90e7f1d...d5f0577
[2.5.0]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/066c5b1...90e7f1d
[2.4.3]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/89ceaf8...066c5b1
[2.4.2]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/73e8884...89ceaf8
[2.4.1]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/61ba637...73e8884
[2.4.0]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/80b729a...61ba637
[withdrawl]: https://github.com/lee-lab-skku/zotero-actionstags-actions/tree/80b729a
