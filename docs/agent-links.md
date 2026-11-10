# Agent link setup

This guide connects clients to Agent Link Bridge and covers profile authentication, skill installation, and troubleshooting.
The bridge returns the same links as the copylink menu actions without changing the clipboard or UI selection.
With known library and target identifiers, an authenticated HTTP client is sufficient; no dedicated Zotero CLI, MCP server, or Actions & Tags fork is required.

## Connect a client

Enable the bridge and configure the client to reach the matching Zotero profile:

1. Follow [Installation](../README.md#installation), importing Agent Link Bridge and all three copylink actions together.
1. Keep the bridge and required copylink actions enabled, then restart Zotero.
   Restart again after importing or re-enabling the bridge.
1. In Zotero's Advanced Config Editor, verify that `extensions.zotero.httpServer.enabled` is true.
   The usual address is `http://127.0.0.1:23119`; use the port in `extensions.zotero.httpServer.port` if different.
1. Read `extensions.zotero.actionsTags.actions.linkBridgeToken`, created once per profile at startup.
   Store its value in the client's private configuration or `ACTION_LINK_TOKEN` environment variable.
   Keep it out of shared documents, command output, and agent answers.
   The client must reach the Zotero instance and profile that owns this token.

The token survives restarts.
To rotate it, clear the token preference, restart Zotero, and update the client configuration.
Disabling Agent Link Bridge stops link requests.

## Install the agent skill

Download `zot-jot.zip` from the same [release](https://github.com/lee-lab-skku/zotero-actionstags-actions/releases) as the action backup.
Extract it and install the complete `zot-jot/` directory in your agent's skill location, keeping `SKILL.md` and `references/` together.
If your installer accepts a ZIP directly, provide that file.

Alternatively, install the complete [`skills/zot-jot`](../skills/zot-jot/SKILL.md) directory from a checkout of the matching release tag.
Each release description links both the ZIP and the skill directory pinned to that tag.
For installers that accept GitHub directory URLs, use the tagged directory link.
Importing or updating Zotero actions does not install or update the skill; install the matching skill separately when upgrading.

The [zot-jot skill](../skills/zot-jot/SKILL.md) (Zotero &mdash; Jump, Open, Trace) describes the agent workflow.
Its [API reference](../skills/zot-jot/references/api.md) covers direct shell requests, request/response fields, and detailed errors for all clients.
Better Notes is required for note links; Better BibTeX is optional.

## Troubleshooting

Use the symptom to choose the connection or dependency check:

| Symptom | Check |
| --- | --- |
| Connection refused | Zotero is running, the HTTP server is enabled, the port is correct, and the bridge loaded at startup. |
| Authentication failure | The client token belongs to the connected Zotero profile. |
| `MISSING_RESULT` from an old copylink action | Import the updated bridge and all three copylink actions together, then restart Zotero. |
| Note-link failure | Better Notes is installed and compatible. |
