# Agent link setup

This guide connects clients to Agent Link Bridge and covers profile authentication, skill installation, and troubleshooting.
The bridge returns the same links as the copylink menu actions without changing the clipboard or UI selection.
With known library and target identifiers, an authenticated HTTP client is sufficient; no dedicated Zotero CLI, MCP server, or Actions & Tags fork is required.

## Connect a client

Enable the bridge and configure the client to reach the matching Zotero profile:

1. If the bridge or copylink actions are missing or outdated, follow [Installation](../README.md#installation) to import all four actions and restart Zotero.
1. Verify that the bridge and required copylink actions are enabled.
   If you have not restarted since the last import or re-enabling of these actions, restart Zotero to load them.
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

Importing or updating Zotero actions does not install or update the skill.
Install or update the matching skill separately:

1. Open the same [release](https://github.com/lee-lab-skku/zotero-actionstags-actions/releases) as the action backup.
   Each release description links both `zot-jot.zip` and the skill directory pinned to that tag.
1. Install the complete skill using a method supported by your agent:

   | Installer input | Installation method |
   | --- | --- |
   | ZIP file | Download `zot-jot.zip` and provide it directly to the installer. |
   | GitHub directory URL | Provide the release's tagged skill-directory link. |
   | Local directory | Extract `zot-jot.zip` and install the complete `zot-jot/` directory, or install `skills/zot-jot/` from a checkout of the matching tag. |

   Keep `SKILL.md` and `references/` together in your agent's skill location.

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
