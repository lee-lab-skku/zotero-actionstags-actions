---
name: zot-jot
description: Generate links to Zotero items, PDF annotations, and Better Notes notes through the Actions & Tags Agent Link Bridge when those links are needed. Also use for bridge setup checks and link-request failures. Library searches, metadata edits, and acquisition are outside this skill.
---

# Zotero &mdash; Jump, Open, Trace

Use the installed copylink actions to obtain links without changing the clipboard or UI selection.
Respect the user's library scope and citation policy; this skill does not choose a default library or impose a citation style on formal deliverables.

## Resolve the target and connection

- Use verified library scope and target keys supplied by the task or already available context.
  If these identifiers are missing, resolve them through available means or ask for the missing information before requesting links.
  Do not infer an item key from a title or citation key.
  With known identifiers, an authenticated HTTP client is sufficient; no dedicated Zotero CLI or MCP server is required.
- Choose `copySelectionLink` for items, `copyAnnotationLink` for PDF annotations, or `copyNoteLink` for Better Notes notes.
  Use keys for the actual targets, not their parents when requesting annotation or note links.
  Better Notes is required only for note links; Better BibTeX is optional.
- Start connection discovery with existing client settings and the active Zotero profile.
  Inspect only the needed server and token preferences before expanding the search.
  Zotero's HTTP server preference `extensions.zotero.httpServer.enabled` must be true; its usual address is `http://127.0.0.1:23119`, with the port controlled by `extensions.zotero.httpServer.port`.
- Use the token belonging to that profile, from private client configuration, `ACTION_LINK_TOKEN`, or the preference `extensions.zotero.actionsTags.actions.linkBridgeToken`.
  Keep tokens out of command output, shared documents, and answers.
  Startup creates the token; missing setup requires importing/enabling the bridge and copylink actions and restarting Zotero.
  Do not change preferences, rotate a token, or import actions merely to generate a link unless authorized.

## Request and render links

Read [API contract](references/api.md) for the exact request, response, and error semantics before calling the bridge.

- Send authenticated JSON to `POST /action-links` at the configured address, following the execution environment's network and approval rules.
- Specify the library explicitly.
  A web group ID is not Zotero's internal library ID.
  For selection links, include `collectionKey` when the task identifies a relevant collection and the requested items belong to it; do not infer collection scope from the UI selection.
- Keep requests sequential and inspect both the HTTP result and response body.
  A batch is all-or-error, with no partial links or request queue.
- For `ok: true`, return links in the requested output format using the returned `uri`, plain-text `label`, and escaped `html` fields.
  For Markdown, use `[label](uri)` without any escaping; for HTML, use the returned `html`; for a plain URL, use `uri`.
  Do not reconstruct URIs or replace action-generated labels with guessed citation keys.

## Handle failures

Use the API reference to distinguish connection, authentication, scope, target, dependency, and busy errors.
A timeout does not cancel the running action; wait before retrying, and retry only after the relevant condition changes or a busy request finishes.
Do not repeatedly probe a missing or disabled bridge, or expand a link request into installation or open-ended diagnosis.
Report the concrete blocker and follow the user's requested fallback behavior when a link cannot be obtained.
If no fallback is specified, report that the link could not be generated.
