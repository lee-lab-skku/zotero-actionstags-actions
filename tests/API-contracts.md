# API contracts and test oracles

Unit expectations come from the supported API contracts and the repository's stated behavior, rather than copying an action's implementation into its expected result.
The reviewed references below describe Zotero 10.0.1, Actions & Tags 2.6.2, toolkit 5.2.0, and Better Notes 3.3.3.
They are sources for the test doubles, not a claim that these installed versions have passed an end-to-end run.

| Boundary | Source-backed contract | Local assertion |
| --- | --- | --- |
| A&T execution | [`applyAction`](https://github.com/windingwind/zotero-actions-tags/blob/v2.6.2/src/utils/actions.ts) injects `item`, `items`, `collection` for ordinary actions, only `window` for events 9/10, and no item/window arguments for event 8; `require` and `triggerType` are always provided. | The shared runner uses the persisted event. Independent runner fixtures check absent startup globals, window ownership and item/selection defaults. |
| A&T dispatch | [`dispatchActionByKey`](https://github.com/windingwind/zotero-actions-tags/blob/v2.6.2/src/modules/dispatch.ts) awaits safe execution and drops the action body's return value. Script exceptions are logged by A&T. | The bridge mock drops returns and catches script failures. Direct body tests assert propagation to this boundary; the bridge must receive an explicit result or report failure. |
| Action metadata | A&T's [`ActionData` and enums](https://github.com/windingwind/zotero-actions-tags/blob/v2.6.2/src/utils/actions.ts) persist numeric event/operation values; operations are 0 through 5. | Build validation rejects non-integers, YAML booleans, negative values and unsupported operations before publishing/writing a backup. |
| Selection and PDF URIs | Zotero's [`SelectExtension` and `OpenExtension`](https://github.com/zotero/zotero/blob/10.0.1/chrome/content/zotero/ZoteroProtocolHandler.mjs) use `library` for personal items, external group IDs for group URLs, and a one-based PDF `page` parameter. | Exact personal/group/collection URIs and page-zero to page-one conversion are asserted independently. |
| Item hierarchy | [`getTopLevel`](https://github.com/zotero/zotero/blob/10.0.1/chrome/content/zotero/xpcom/data/items.js) follows [`topLevelItem`](https://github.com/zotero/zotero/blob/10.0.1/chrome/content/zotero/xpcom/data/item.js) recursively and deduplicates. | The fake resolves the complete parent chain. PDF annotations and standalone PDFs use the correct top-level label. |
| Collection selection | [`ZoteroPane`](https://github.com/zotero/zotero/blob/10.0.1/chrome/content/zotero/zoteroPane.js) exposes plural collection getters. | Mixed collection/search selections keep library scope; exactly one selected collection may scope a link. |
| HTTP endpoint | [`Zotero.Server`](https://github.com/zotero/zotero/blob/10.0.1/chrome/content/zotero/xpcom/server/server.js) supplies lowercase/case-insensitive headers and accepts an async one-argument endpoint returning `[status, contentType, body]`. | Endpoint doubles supply decoded requests and lowercase headers. Authentication, validation, malformed results, concurrent calls and bridge replacement are tested without opening sockets. |
| Clipboard | [`ClipboardHelper`](https://github.com/windingwind/zotero-plugin-toolkit/blob/v5.2.0/src/helpers/clipboard.ts) accepts separate text and HTML flavors and exposes `copy()`; it maps requested `text/unicode` to `text/plain` internally. | Doubles record the requested text/HTML before copying. They check escaping and complete output, not the operating system's clipboard representation. |
| Better Notes | [`note2link`](https://github.com/windingwind/zotero-better-notes/blob/v3.3.3/src/utils/convert.ts) delegates to [`getNoteLink`](https://github.com/windingwind/zotero-better-notes/blob/v3.3.3/src/utils/link.ts). Note links use Better Notes' own library conventions. | The converter supplies an opaque URI which copyNoteLink preserves and escapes in HTML. Tests do not reconstruct note URIs using Zotero selection-link group rules. Missing/failing converters do not produce clipboard writes or partial bridge success. |

Repository-specific expectations include citation-key/title/item-key fallback, parent-attachment deduplication, HTML escaping, and keeping bridge requests separate from menu clipboard behavior.

## Coverage interpretation

`tests/tooling/run-coverage.py` measures action bodies with Node's built-in V8 coverage and measures `build.py` with coverage.py's subprocess patch.
The runner compiles action bodies into generated async functions with the A&T argument shape and injects a test clock where needed.
Inline maps preserve original line and column positions; all workers use the same compiled file so Node can merge coverage consistently.
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

YAML import/editor persistence, other event wiring, OS clipboard flavors, opening returned URIs, reader behavior, shared-library access, and platform differences require additional installed-environment tests.
Local mocks and coverage cannot establish those behaviors.
