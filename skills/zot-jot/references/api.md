# Action link API

The Agent Link Bridge exposes the three copylink actions through Zotero's existing local HTTP server.
Read this reference before constructing a request or diagnosing a response.
The server must be enabled and the bridge and updated copylink actions must be enabled and loaded in the same profile.

## Request

Send JSON with `Content-Type: application/json` and `X-Action-Link-Token`.
For example, in Bash, with the token already stored in the environment:

```sh
curl --fail-with-body --silent --show-error --max-time 15 \
  http://127.0.0.1:23119/action-links \
  -H 'Content-Type: application/json' \
  -H "X-Action-Link-Token: $ACTION_LINK_TOKEN" \
  --data '{"action":"copySelectionLink","library":{"type":"group","id":100},"itemKeys":["ABCD1234"]}'
```

Replace the example group ID and item keys with locally available values. For My Library, use `"library":{"type":"user"}` without an ID.

| Field | Contract |
| --- | --- |
| `action` | `copySelectionLink`, `copyAnnotationLink`, or `copyNoteLink` only |
| `library` | `{ "type": "group", "id": groupID }` or `{ "type": "user" }`; a group ID is not Zotero's internal library ID |
| `itemKeys` | Nonempty array of eight-character uppercase Zotero item keys, all in the specified library; duplicate keys are removed |
| `collectionKey` | Optional, only for `copySelectionLink`; an existing collection in that library |
| `wordRanges` | Optional, only for `copyAnnotationLink`; maps keys from `itemKeys` to `{ "start": integer, "end": optional integer }` as described below |
| `prefixes` | Optional, only for `copyAnnotationLink`; maps keys from `itemKeys` to plain-text strings to prepend with an automatic separator |

A selection request runs once for the supplied items.
Child attachment targets resolve to their parent and duplicate parent links are removed.
With no `collectionKey`, links use the library path even if a collection is currently selected in the UI.
With a collection key, only items belonging to that collection receive a collection path.

An annotation request requires PDF annotation keys and includes the attachment, page, and annotation key in the URI.
A note request requires note keys and a compatible Better Notes installation.
Both run sequentially per item.
Better BibTeX is optional; labels fall back to titles or keys.

## Annotation word ranges

Annotation previews, including menu calls and requests without ranges, show at most the first eight words.
A word is a maximal non-whitespace sequence, as matched by JavaScript `/\S+/gu`; repeated spaces, tabs and line breaks separate words without adding empty words.
Punctuation stays attached: `don't` and `state-of-the-art` each count as one word.
The preview preserves the original whitespace between selected words and excludes whitespace before the first and after the last selected word.
Empty and whitespace-only annotations, including area/image annotations, show `p. <page> (citation key, title, or item key)`.
The page uses the trimmed annotation page label when nonempty, otherwise the one-based PDF page number.
Comments are not used as previews, and the URI always uses the physical PDF page number regardless of its displayed label.

Use `wordRanges` to select different passages from annotations in one batch:

```json
{
  "action": "copyAnnotationLink",
  "library": { "type": "user" },
  "itemKeys": ["ANN00001", "ANN00002", "ANN00003"],
  "wordRanges": {
    "ANN00001": { "start": 2, "end": 5 },
    "ANN00002": { "start": 5 }
  }
}
```

`start` is a required zero-based word index, included in the selection.
`end` is an optional exclusive word index; omission selects through the last word.
Thus `{ "start": 2, "end": 5 }` selects the third, fourth and fifth words, and `{ "start": 0 }` selects the entire annotation without the default eight-word limit.
All indices must be nonnegative safe integers, and a supplied `end` must be greater than `start`.
Each range key must appear in `itemKeys`.
Keys absent from `wordRanges`, including all keys when the map is empty, use the default first eight words.
Duplicate item keys still produce one link, in first-occurrence request order; requesting several passages from the same annotation requires separate requests.

An omitted prefix adds `... ` before the selected text; an omitted suffix adds `...` after it.
For `The quick brown fox jumps over the lazy dog.`, selecting `[2, 5)` produces `... brown fox jumps... (citationKey)`.
Only the label changes; the URI still opens the original annotation, not a new PDF text selection.

Every updated annotation action returns `itemKey` and the actual applied `wordRange` alongside `uri`, `label`, and `html`:

```json
{
  "itemKey": "ANN00001",
  "wordRange": { "start": 2, "end": 5, "totalWords": 9 }
}
```

The response resolves an omitted `end` to the actual word count.
Default previews report `start: 0` and `end: min(8, totalWords)`; empty default previews report all three numbers as zero.
Explicit ranges must select at least one word and fit entirely within the annotation.
They are never clamped or replaced with a default preview, and one invalid target fails the batch without partial links.

Compute indices programmatically from the same annotation text using the word rule above; do not estimate character offsets or count words from a normalized PDF transcription.
An edit to the annotation text can change which words occupy a range.
For explicit requests, verify each returned `itemKey`, `wordRange.start`, and `wordRange.end` against the request, resolving an omitted end using `totalWords`.
Old bridges can ignore `wordRanges`, so HTTP 200 alone does not confirm that the requested passage was selected.
Treat missing or mismatched metadata as unsupported or invalid, and do not use the result as the requested passage.
The updated bridge rejects explicit ranges from old annotation actions with `UNSUPPORTED_WORD_RANGE`; default requests can still work with old actions.
Import the updated bridge and annotation action together, restart Zotero, and update the separately installed skill when upgrading.

## Annotation prefixes

Use `prefixes` to prepend custom text to individual annotation link labels:

```json
{
  "action": "copyAnnotationLink",
  "library": { "type": "user" },
  "itemKeys": ["ANN00001"],
  "prefixes": { "ANN00001": "Figure 3" }
}
```

For an area annotation on page 5, this produces `Figure 3 — p. 5 (citationKey)`.
The bridge trims leading and trailing whitespace from each prefix; internal text and whitespace are preserved.
The action adds a space, em dash, and space (` — `) automatically between a nonempty prefix and the ordinary label.
Do not include that separator in the supplied prefix.
An empty or whitespace-only prefix adds neither text nor a separator.
Missing keys, or an empty map, leave the corresponding labels unchanged.
Every map key must appear in `itemKeys`, and every value must be a string.

Prefixes also work with text annotations and `wordRanges`: `Context — ... selected words... (citationKey)`.
They do not count toward word ranges or the eight-word preview limit, and they do not make an explicit range on empty annotation text valid.
Prefixes are plain text, escaped in `html`; they do not alter the URI, saved annotation, or clipboard.
Duplicate item keys produce one link as usual.

For each explicitly supplied prefix, the returned link includes `prefix` containing the trimmed string, including `""` for an empty prefix.
Verify that `itemKey` and `prefix` match the request before using the link.
Old bridges may ignore `prefixes`; HTTP 200 without matching metadata does not confirm support.
The updated bridge rejects old annotation actions that cannot confirm prefixes with `UNSUPPORTED_PREFIX`.
Import the updated bridge and annotation action together and restart Zotero; update the separately installed skill as well.

## Response and failures

A successful request returns HTTP 200:

```json
{
  "ok": true,
  "links": [
    {
      "uri": "zotero://select/groups/100/items/ABCD1234",
      "label": "Smith2026",
      "html": "<a href=\"zotero://select/groups/100/items/ABCD1234\">Smith2026</a>"
    }
  ]
}
```

Choose the returned fields to match the requested output format.
Use `uri` for a plain URL, `uri` and the plain-text `label` for a formatted link, or `html` for the action's escaped HTML representation.
Requests do not copy to the clipboard or show action messages.
Existing menu invocations continue to copy their usual plain URL and HTML content.

Errors have `{ "ok": false, "error": { "code": "…", "message": "…" } }`:

| HTTP status | Meaning |
| --- | --- |
| 400 | Unsupported action or invalid request, library, collection scope, word range, or prefix |
| 403 | Missing/incorrect token, or a browser Origin header |
| 404 | Item or collection missing/deleted in the specified library |
| 409 | Another request is running; retry after it finishes |
| 422 | Copylink action rejected its target or word range, or its conversion failed |
| 500 | Unexpected failure, malformed result, or old copylink script that does not report a result |
| 503 | Bridge or requested action missing/disabled, or bridge replaced during a request |

A batch returns all links or an error; it never returns partial results.
There is no request queue.
Browser access is not enabled.
Unsupported methods or content types can be rejected by Zotero's server before the bridge runs, with Zotero's own response format.

Word-range errors use `INVALID_WORD_RANGE` (400) for malformed maps, keys outside `itemKeys`, wrong-action use, invalid numbers, or reversed/empty ranges.
`WORD_RANGE_OUT_OF_BOUNDS` (422) means a structurally valid range exceeds the annotation word count, including an explicit range on empty text.
`UNSUPPORTED_WORD_RANGE` (500) means the action did not report the metadata needed to confirm an explicit range.
Prefix errors use `INVALID_PREFIX` (400) for malformed maps, keys outside `itemKeys`, wrong-action use, or non-string values.
`UNSUPPORTED_PREFIX` (500) means the action did not report the metadata needed to confirm an explicit prefix.
`INVALID_RESULT` (500) includes mismatched annotation keys or inconsistent applied ranges or prefixes.

If you receive `MISSING_RESULT`, import the updated three copylink actions together with the bridge.
If the connection is refused, check the server preference, port, startup action, and profile.
If note conversion fails, check that Better Notes is installed and compatible.
A client timeout does not cancel an action already running; wait before retrying.
