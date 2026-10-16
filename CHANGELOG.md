<!-- markdownlint-disable MD024 -->

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For this changelog, `withdrawl` at commit `80b729a` is the initial baseline, without a release date; earlier versions are intentionally omitted.
Version `2.4.2` describes changes from that baseline, and each later version describes changes from the preceding listed version.

## [Unreleased]

## [3.0.0-rc.3] &mdash; 2026-10-16

### Added

- Per-annotation word ranges for Agent Link Bridge requests, with applied range metadata in annotation link responses.
  Clients can select a passage or the full annotation text; invalid ranges fail the batch, and explicit ranges require the updated bridge and annotation action.
- Per-annotation plain-text prefixes for Agent Link Bridge requests, with an automatic em-dash separator and applied prefix metadata in responses.
  Surrounding whitespace is trimmed, empty prefixes add no separator, and prefixes work alongside word ranges without changing annotation text or link destinations.
  Explicit prefixes require the updated bridge and annotation action.
- A bundled `zot-jot` agent skill for generating item, PDF annotation, and Better Notes links through Agent Link Bridge, with a self-contained API reference and setup and troubleshooting guidance.
  It supports Markdown, HTML, and plain URL output and verifies applied word ranges and prefixes for annotation links.
  Releases include a validated `zot-jot.zip`, a direct download link, and a skill-directory link pinned to the release tag.
  Install or update the skill separately from the Zotero actions.
- Manual release previews with an intended tag, the same tests and real Zotero verification as tag releases, and a downloadable bundle containing the release body, YAML/JSON backups, and skill ZIP.
  The run summary shows the rendered release body and asset sizes; preview runs do not create tags or GitHub Releases.

### Changed

- Default annotation previews now count the first eight whitespace-separated words, preserving spaces, tabs, and line breaks between them.
- Empty or whitespace-only annotations, including area/image annotations, now show `p. <page> (citation key, title, or item key)`.
  The page uses Zotero's annotation page label when available, otherwise the one-based PDF page number.
- Release publication now consumes a prepared bundle containing the verified backups, tested skill ZIP, and release body without rebuilding assets or rendering the body again.
- Add agent link setup instructions to README.
- The Update Actions version selection dialog now clarifies that updating actions does not replace installed agent skills.

### Fixed

- Annotation link previews now show ellipses only when words are omitted.

## [3.0.0-rc.2] &mdash; 2026-10-15

### Added

- Standard Actions & Tags backup fields for Zotero and plugin versions in verified release assets, and a shared UTC creation timestamp in YAML and JSON builds.
- Local coverage reports for original action sources and subprocess builds, with JavaScript LCOV and Python HTML/JSON output.
- Expanded regression tests grounded in documented API contracts, covering action dispatch, links, preferences, review dates, update failures, and bridge lifecycle behavior.
- Real Zotero integration verification, available manually and required for releases, using Zotero 10.0.6 and Actions & Tags 2.6.2 in a disposable profile under Xvfb.
  It checks actual startup dispatch and authenticated bridge requests, requires matching installed versions and a successful exit within 120 seconds, and retains reports and logs.

### Changed

- Tag releases now run the shared test workflow before publishing and build the same triggering commit that was tested.
  Publishing also requires successful real-app verification and uses its exact YAML and JSON backups without rebuilding.
- CI now builds backups and checks build behavior, action logic, test tooling, the HTTP bridge socket, and commit whitespace; the shared workflow also supports manual runs.
- Separate unit, build, tooling, and integration suites so default local checks require no Zotero installation or socket binding.
  Real-app verification runs separately; its current automation covers bridge/copylink behavior and does not replace the remaining manual release checks.
- Run CI on Ubuntu 24.04 with updated external actions; cancel superseded branch/PR test runs and serialize releases per tag without cancelling active releases.

### Fixed

- Reject boolean or negative action events and invalid operation enum values during backup generation.

## [3.0.0-rc.1] &mdash; 2026-10-14

### Changed

- Embed updater version and source repository in script constants instead of custom action fields, so editing activation or menu settings in Actions & Tags retains this information.
- Turn on the Update Actions by default.

### Fixed

- Run global preference, update, and VPN menu commands once per selection, filtering item-level follow-up calls without changing other action dispatches.
  Suppress overlapping executions of the same command and release the guard after completion, cancellation, or failure.

## [3.0.0-beta.4] &mdash; 2026-10-14

### Added

- Version and source repository metadata in generated YAML/JSON backups, both at the file root and inside Update Actions.
- A prerelease opt-in question in Set preferences.
  Startup remembers the choice.

### Changed

- Update Actions now offers an interactive selection only when an aligned release has a newer SemVer tag than the installed base tag.
- Fetch releases from the installed source repository and apply the selected JSON backup after validation.
- Release CI passes the triggering tag and source repository to the build so published YAML/JSON backups identify their release and update source.

## [3.0.0-beta.3] &mdash; 2026-10-14

### Changed

- Trash on Delete now swaps both collection shortcuts: Delete moves items to the library trash, and Shift+Delete removes them from the collection.

### Removed

- **Breaking:** Remove the legacy `tara.groupID` fallback during preference setup.
  Users without a current organization setting must select their group once.

- **Breaking:** Remove Share Item and Retrieve Item, including the share collection prompt from preference setup.
  Delete previously installed copies in Actions & Tags; automatic updates do not remove actions absent from the release backup.

## [3.0.0-beta.2] &mdash; 2026-10-13

### Added

- A Trash on Delete action that moves selected collection items to the library trash with Zotero's confirmation and Undo support.
  Restart Zotero after importing to activate it; disabling the action immediately restores normal collection removal.
- An Agent Link Bridge startup action exposing `POST /action-links` on Zotero's existing local HTTP server.
  Local clients can request selection, PDF annotation, and Better Notes links by explicit library and item keys, with an optional collection key for selection links.
- Profile-token authentication and structured link/error responses for the three copylink actions, preserving their existing menu and clipboard behavior.
  Import the updated copylink actions together with the bridge and restart Zotero before pairing a client.

### Changed

- Test CI runs all Node.js test files, including the bridge suite, instead of only the action behavior suite.

## [3.0.0-beta.1] &mdash; 2026-09-10

### Added

- JSON release backups for automatic updates, alongside the YAML import file.
- Regression tests and CI that run Python backup-generation tests and Node.js action behavior tests on pushes and pull requests.
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

## [2.6.0] &mdash; 2026-06-15

### Added

- A WebDAV reachability check at startup and in the Tools menu, warning when the server does not respond within five seconds.

## [2.5.1] &mdash; 2026-06-15

### Fixed

- PDF annotation links now identify the parent attachment in the item path and the annotation in the query, fixing links that failed to open the PDF.

## [2.5.0] &mdash; 2026-01-07

### Added

- Copy selection links for multiple items in one operation, using newline-separated plain URLs and separate HTML links.

### Changed

- Generate selection links once for the whole selection, resolving child attachments to their parent items.

## [2.4.3] &mdash; 2026-01-07

### Added

- A lookup of the legacy `tara.groupID` preference during organization setup.

### Changed

- Disable automatic action updates by default.
- Update action descriptions to explain shared preference setup and the configured share collection.

## [2.4.2] &mdash; 2025-12-01

### Added

- A startup action to configure the organization, review collection, share collection, and reviewer name in one place.
- Update summaries distinguishing new, updated, and unchanged actions.

### Changed

- Store shared settings under `actionsTags.actions.*` and use configured destinations for sharing and review notes instead of per-action setup or hardcoded sharing targets.
- Restrict retrieval to items belonging to the configured share collection.
- Rename the generated backup to `actions-zotero.yml` and discover update assets by their `.yml` extension.
- Initialize the automatic updater's version on its first run without applying an update, and skip unchanged action definitions on later updates.
- Return readable completion messages from retrieval and review actions.
- Extend the selectable review dates from today through seven days ahead to today through fourteen days ahead.

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

[Unreleased]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/v3.0.0-rc.3...HEAD
[3.0.0-rc.3]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/v3.0.0-rc.2...v3.0.0-rc.3
[3.0.0-rc.2]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/v3.0.0-rc.1...v3.0.0-rc.2
[3.0.0-rc.1]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/v3.0.0-beta.4...v3.0.0-rc.1
[3.0.0-beta.4]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/v3.0.0-beta.3...v3.0.0-beta.4
[3.0.0-beta.3]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/v3.0.0-beta.2...v3.0.0-beta.3
[3.0.0-beta.2]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/v3.0.0-beta.1...v3.0.0-beta.2
[3.0.0-beta.1]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/v2.6.0...v3.0.0-beta.1
[2.6.0]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/v2.5.1...v2.6.0
[2.5.1]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/v2.5.0...v2.5.1
[2.5.0]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/v2.4.3...v2.5.0
[2.4.3]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/v2.4.2...v2.4.3
[2.4.2]: https://github.com/lee-lab-skku/zotero-actionstags-actions/compare/80b729a...v2.4.2
[withdrawl]: https://github.com/lee-lab-skku/zotero-actionstags-actions/tree/80b729a
