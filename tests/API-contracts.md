# API contracts and test oracles

Unit expectations come from the supported API contracts and the repository's stated behavior, rather than copying an action's implementation into its expected result.
The reviewed references below describe Zotero 10.0.1, Actions & Tags 2.6.2, toolkit 5.2.0, and Better Notes 3.3.3.
They are sources for the test doubles, not a claim that these installed versions have passed an end-to-end run.

| Boundary | Source-backed contract | Local assertion |
| --- | --- | --- |
| A&T execution | [`applyAction`](https://github.com/windingwind/zotero-actions-tags/blob/v2.6.2/src/utils/actions.ts) injects `item`, `items`, `collection` for ordinary actions, only `window` for events 9/10, and no item/window arguments for event 8; `require` and `triggerType` are always provided. | The shared runner uses the persisted event. Independent runner fixtures check absent startup globals, window ownership and item/selection defaults. |
| A&T dispatch | [`dispatchActionByKey`](https://github.com/windingwind/zotero-actions-tags/blob/v2.6.2/src/modules/dispatch.ts) awaits safe execution and drops the action body's return value. Script exceptions are logged by A&T. | The bridge mock drops returns and catches script failures. Direct body tests assert propagation to this boundary; the bridge must receive an explicit result or report failure. |
| Action metadata | A&T's [`ActionData` and enums](https://github.com/windingwind/zotero-actions-tags/blob/v2.6.2/src/utils/actions.ts) persist numeric event/operation values; operations are 0 through 5. | Build and update validation reject non-integers, YAML booleans, negative values and unsupported operations before publishing/writing a backup. |
| Selection and PDF URIs | Zotero's [`SelectExtension` and `OpenExtension`](https://github.com/zotero/zotero/blob/10.0.1/chrome/content/zotero/ZoteroProtocolHandler.mjs) use `library` for personal items, external group IDs for group URLs, and a one-based PDF `page` parameter. | Exact personal/group/collection URIs and page-zero to page-one conversion are asserted independently. |
| Item hierarchy | [`getTopLevel`](https://github.com/zotero/zotero/blob/10.0.1/chrome/content/zotero/xpcom/data/items.js) follows [`topLevelItem`](https://github.com/zotero/zotero/blob/10.0.1/chrome/content/zotero/xpcom/data/item.js) recursively and deduplicates. | The fake resolves the complete parent chain. PDF annotations and standalone PDFs use the correct top-level label. |
| Selection and Delete | [`ZoteroPane`](https://github.com/zotero/zotero/blob/10.0.1/chrome/content/zotero/zoteroPane.js) exposes plural collection getters; `deleteSelectedItems(force, fromMenu)` owns permissions, confirmation and deletion. | Mixed selections keep library scope. Delete delegates `(true, true)` and Shift+Delete `(false, true)` to the owning window; separate windows have separate listeners and busy state. |
| Collections | [`getByLibrary`](https://github.com/zotero/zotero/blob/10.0.1/chrome/content/zotero/xpcom/data/collections.js) accepts library ID and a recursive flag, excluding trashed collections by default. | Preference setup requests the selected group's library recursively, replaces stale settings, and respects cancelled or invalid choices. |
| HTTP requests | [`Zotero.HTTP.request`](https://github.com/zotero/zotero/blob/10.0.1/chrome/content/zotero/xpcom/http.js) returns XHR, rejects non-2xx by default, allows all response statuses with `successCodes: false`, and accepts millisecond timeout and JSON response type. | The VPN check accepts received HTTP error statuses as reachability; the updater requests JSON with bounded timeout, propagates HTTP failures and releases its running guard. |
| HTTP endpoint | [`Zotero.Server`](https://github.com/zotero/zotero/blob/10.0.1/chrome/content/zotero/xpcom/server/server.js) supplies lowercase/case-insensitive headers and accepts an async one-argument endpoint returning `[status, contentType, body]`. | Endpoint doubles supply decoded requests and lowercase headers. Authentication, validation, malformed results, concurrent calls and bridge replacement are tested without opening sockets. |
| Clipboard | [`ClipboardHelper`](https://github.com/windingwind/zotero-plugin-toolkit/blob/v5.2.0/src/helpers/clipboard.ts) accepts separate text and HTML flavors and exposes `copy()`; it maps requested `text/unicode` to `text/plain` internally. | Doubles record the requested text/HTML before copying. They check escaping and complete output, not the operating system's clipboard representation. |
| Better Notes | [`note2link`](https://github.com/windingwind/zotero-better-notes/blob/v3.3.3/src/utils/convert.ts) delegates to [`getNoteLink`](https://github.com/windingwind/zotero-better-notes/blob/v3.3.3/src/utils/link.ts). Note links use Better Notes' own library conventions. | The converter supplies an opaque URI which copyNoteLink preserves and escapes in HTML. Tests do not reconstruct note URIs using Zotero selection-link group rules. Missing/failing converters do not produce clipboard writes or partial bridge success. |
| Dialogs | Mozilla's [`nsIPromptService`](https://github.com/mozilla/gecko-dev/blob/master/toolkit/components/windowwatcher/nsIPromptService.idl) defines confirmation button flags and `select`'s boolean result plus selected-index out parameter. | Prerelease opt-in defaults to No. Cancellation is distinct from accepting index zero; invalid selections and blank reviewer input do not invent settings. |
| Release ordering | [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html) defines numeric prerelease precedence, shorter-prefix ordering and stable promotion, and excludes leading zeros in numeric identifiers. | The published ordering example is exercised through the updater's release choices, including invalid tags, drafts, opt-in and cancellation. |

Repository-specific expectations include citation-key/title/item-key fallback, parent-attachment deduplication, HTML escaping, preserving update settings, applying the updater last, and recording a version only after successful writes.
Review-note dates use fixed local calendar examples for year rollover and leap day, rather than deriving expected titles with the production date-formatting code.
Read-only or ineligible review items and cancelled dates produce no new note.

## Coverage interpretation

`tests/tooling/run-coverage.py` measures action bodies with Node's built-in V8 coverage and measures `build.py` with coverage.py's subprocess patch.
The runner compiles action bodies into generated async functions with the A&T argument shape and injects a test clock where needed.
Inline maps preserve original line and column positions; all workers use the same compiled file so Node can merge coverage consistently.
Updater provenance values are passed into the generated test function, preserving each test's installed-version/source value while avoiding multiple competing maps for one source file.
Generated wrappers are test infrastructure and are not release assets.
A separate fixture checks that an unexecuted return stays uncovered at its original source line, and the coverage command refuses an empty or incomplete action report.

Line coverage includes V8's physical-line accounting, and function coverage includes the generated action function.
Multiple conditions on one line can still be untested when line coverage is complete; inspect branch coverage and assertions together.
Python's statement/branch counts and V8's line/block counts have different meanings and should not be combined into one percentage.
No coverage percentage threshold is enforced.

## Integration boundaries

The unit suite requires no installed Zotero or plugins and opens no network sockets.
The separate socket test validates an HTTP client against the bridge's endpoint contract using mocked Zotero/A&T objects.
The [real-app integration verification](integration/zotero/README.md#ci-verification) uses real Zotero objects and an installed A&T plugin.
It checks persisted action definitions, actual startup dispatch, database-backed link targets, and localhost responses, while recording and checking the installed version pair.

YAML import/editor persistence, other event wiring, database permission/transaction edge cases, confirmations/Undo, OS clipboard flavors, opening returned URIs, reader behavior, shared-library access, and platform differences require additional installed-environment tests.
Local mocks and coverage cannot establish those behaviors.
