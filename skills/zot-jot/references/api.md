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

A selection request runs once for the supplied items.
Child attachment targets resolve to their parent and duplicate parent links are removed.
With no `collectionKey`, links use the library path even if a collection is currently selected in the UI.
With a collection key, only items belonging to that collection receive a collection path.

An annotation request requires PDF annotation keys and includes the attachment, page, and annotation key in the URI.
A note request requires note keys and a compatible Better Notes installation.
Both run sequentially per item.
Better BibTeX is optional; labels fall back to titles or keys.

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
| 400 | Unsupported action or invalid request, library, or collection scope |
| 403 | Missing/incorrect token, or a browser Origin header |
| 404 | Item or collection missing/deleted in the specified library |
| 409 | Another request is running; retry after it finishes |
| 422 | Copylink action rejected its target, or its conversion failed |
| 500 | Unexpected failure, malformed result, or old copylink script that does not report a result |
| 503 | Bridge or requested action missing/disabled, or bridge replaced during a request |

A batch returns all links or an error; it never returns partial results.
There is no request queue.
Browser access is not enabled.
Unsupported methods or content types can be rejected by Zotero's server before the bridge runs, with Zotero's own response format.

If you receive `MISSING_RESULT`, import the updated three copylink actions together with the bridge.
If the connection is refused, check the server preference, port, startup action, and profile.
If note conversion fails, check that Better Notes is installed and compatible.
A client timeout does not cancel an action already running; wait before retrying.
