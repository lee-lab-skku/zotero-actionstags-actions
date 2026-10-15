---
name: zotero-action-links
description: Generate Zotero item, PDF annotation, and Better Notes links through the Actions & Tags Agent Link Bridge, including when citing saved literature in answers or internal documents. Use for bridge setup checks and link-request failures; use a library-access tool for searches, metadata edits, or acquisition.
---

# Zotero action links

Use the installed copylink actions to obtain links without changing the clipboard or UI selection.
Respect the user's library scope and citation policy; this skill does not choose a default library or impose a citation style on formal deliverables.

## Resolve the target and connection

- Obtain verified library scope and target keys from the task or an available library-access tool, such as `zotero-cli`.
  Do not infer an item key from a title or citation key.
- Choose `copySelectionLink` for items, `copyAnnotationLink` for PDF annotations, or `copyNoteLink` for Better Notes notes.
  Use keys for the actual targets, not their parents when requesting annotation or note links.
  Better Notes is required only for note links; Better BibTeX is optional.
- Start connection discovery with existing client settings and the active Zotero profile.
  Inspect only the needed server and token preferences before expanding the search.
  Zotero's HTTP server preference `extensions.zotero.httpServer.enabled` must be true; its usual address is `http://127.0.0.1:23119`, with the port controlled by `extensions.zotero.httpServer.port`.
  Windows and WSL may require different localhost routing.
- Use the token belonging to that profile, from private client configuration, `ACTION_LINK_TOKEN`, or the preference `extensions.zotero.actionsTags.actions.linkBridgeToken`.
  Keep tokens out of command output, shared documents, and answers.
  Startup creates the token; missing setup requires importing/enabling the bridge and copylink actions and restarting Zotero.
  Do not change preferences, rotate a token, or import actions merely to generate a link unless authorized.

## Request and render links

Read [API contract](references/api.md) for the exact request, response, and error semantics before calling the bridge.

- Send authenticated JSON to `POST /action-links` at the configured address, following the execution environment's network and approval rules.
- Specify the library explicitly.
  A web group ID is not Zotero's internal library ID.
  For selection links, include `collectionKey` when the task identifies a relevant collection and the cited items belong to it; do not infer collection scope from the UI selection.
- Keep requests sequential and inspect both the HTTP result and response body.
  A batch is all-or-error, with no partial links or request queue.
- For `ok: true`, render each returned plain-text `label` and `uri` as `[label](uri)`, escaping Markdown as needed.
  Do not reconstruct URIs or replace action-generated labels with guessed citation keys.

## Handle failures

Use the API reference to distinguish connection, authentication, scope, target, dependency, and busy errors.
A timeout does not cancel the running action; wait before retrying, and retry only after the relevant condition changes or a busy request finishes.
Do not repeatedly probe a missing or disabled bridge, or expand a citation task into installation or open-ended diagnosis.
Report the concrete blocker and follow the user's citation fallback policy when a link cannot be obtained.
