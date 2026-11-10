---
name: zot-jot
description: Generate links to Zotero items, PDF annotations, and Better Notes notes through the Actions & Tags Agent Link Bridge when those links are needed. Also use for bridge setup checks and link-request failures. Library searches, metadata edits, and acquisition are outside this skill.
---

# Zotero &mdash; Jump, Open, Trace

This workflow obtains item, PDF annotation, and Better Notes links through the installed copylink actions without changing the clipboard or UI selection.
It covers target and connection discovery, requests, result validation, and failure handling.
Respect the user's library scope and citation policy; this skill does not choose a default library or impose a citation style on formal deliverables.

## Resolve the target and connection

Resolve identifiers and the matching Zotero profile before requesting links:

1. Use verified library scope and target keys supplied by the task or already available context.
   If these identifiers are missing, resolve them through available means or ask for the missing information before requesting links.
   Do not infer an item key from a title or citation key.
   With known identifiers, an authenticated HTTP client is sufficient; no dedicated Zotero CLI or MCP server is required.
1. Choose the action for the requested link:

   | Requested link | Action |
   | --- | --- |
   | Item selection link | `copySelectionLink` |
   | PDF annotation link | `copyAnnotationLink` |
   | Better Notes note link | `copyNoteLink` |

   Use keys for the actual targets, not their parents when requesting annotation or note links.
   Better Notes is required only for note links; Better BibTeX is optional.
1. Start connection discovery with existing client settings and the active Zotero profile.
   Inspect only the needed server and token preferences before expanding the search.
   Zotero's HTTP server preference `extensions.zotero.httpServer.enabled` must be true; its usual address is `http://127.0.0.1:23119`, with the port controlled by `extensions.zotero.httpServer.port`.
1. Use the token belonging to that profile, from private client configuration, `ACTION_LINK_TOKEN`, or the preference `extensions.zotero.actionsTags.actions.linkBridgeToken`.
   Keep tokens out of command output, shared documents, and answers.
   Startup creates the token; missing setup requires importing/enabling the bridge and copylink actions and restarting Zotero.
   Do not change preferences, rotate a token, or import actions merely to generate a link unless authorized.

## Request and render links

Read [Action link API](references/api.md) for the exact request, response, and error semantics before calling the bridge.
Then request and validate links as follows:

1. Specify the library explicitly.
   A web group ID is not Zotero's internal library ID.
   For selection links, include `collectionKey` when the task identifies a relevant collection and the requested items belong to it; do not infer collection scope from the UI selection.
1. For a requested annotation passage, use `wordRanges` keyed by annotation key.
   Compute zero-based, end-exclusive word indices from the same annotation text, following the API's whitespace rule; omit `end` for the rest of the annotation.
   Do not estimate indices or calculate them from a different or normalized PDF transcription.
   Omit the range when the default first eight words meet the task.
1. For custom text before an annotation label, use `prefixes` keyed by annotation key.
   Supply plain text without a separator; surrounding whitespace is trimmed and a nonempty prefix is followed by an automatic ` — ` separator.
   Area/image annotations without text use a page label, so a prefix can describe the referenced figure or region without changing the annotation.
1. Send authenticated JSON to `POST /action-links` at the configured address, following the execution environment's network and approval rules.
   Keep requests sequential and inspect both the HTTP result and response body.
   A batch is all-or-error, with no partial links or request queue.
1. For explicit prefixes, verify each returned `itemKey` and `prefix` against the requested key and trimmed text.
   Missing or mismatched metadata does not confirm prefix support.
1. For explicit annotation ranges, verify the returned `itemKey` and applied `wordRange` against each request before using the link.
   An omitted `end` must resolve to `totalWords`.
   HTTP 200 is insufficient because old bridges can ignore range fields; missing or mismatched metadata must not be presented as the requested passage.
1. For `ok: true`, return links in the requested output format using the returned `uri`, plain-text `label`, and escaped `html` fields.
   Do not reconstruct URIs or replace action-generated labels with guessed citation keys.
   Choose the returned fields according to the requested format:

   | Format | Output |
   | --- | --- |
   | Markdown | `[label](uri)` without any escaping |
   | HTML | The returned `html` |
   | Plain URL | The returned `uri` |

## Handle failures

Use the API reference to distinguish connection, authentication, scope, target, range, dependency, and busy errors.
Report unsupported ranges or prefixes, or invalid applied metadata, rather than silently falling back to the default annotation preview.

A timeout does not cancel the running action; wait before retrying, and retry only after the relevant condition changes or a busy request finishes.
Do not repeatedly probe a missing or disabled bridge, or expand a link request into installation or open-ended diagnosis.
Report the concrete blocker and follow the user's requested fallback behavior when a link cannot be obtained.
If no fallback is specified, report that the link could not be generated.
