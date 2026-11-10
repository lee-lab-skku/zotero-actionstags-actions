# Upgrading older installations

This guide removes retired actions before importing a current release backup.
For ordinary installation and updates, follow [Installation](../README.md#installation).

## Retired actions

Current releases contain only the three copylink actions and Agent Link Bridge.
Importing a backup does not remove actions already installed in your profile.
The retired actions include:

- **Update Actions**, **Set Preferences**, **Review Note**, **Trash on Delete** (named **Move collection items to trash with Delete**), and **Check VPN**.
- **Add Unread When Create Item** and **Remove Unread When Close Tab**.
- **Share Item** and **Retrieve Item** from older releases.

## Upgrade steps

Before importing a current release into an older profile:

1. Export your installed Actions & Tags definitions as a backup.
1. Disable any old **Update Actions** action.
1. In **Settings &rightarrow; Actions & Tags**, remove the [retired actions](#retired-actions) if installed.
1. Follow [Installation](../README.md#installation) to import the current backup and restart Zotero.
   Restarting unloads the removed actions' listeners and menu handlers.

Legacy preference values can remain; the copylink actions do not use the old group, review, sharing, reviewer, or update settings.
Keep the bridge token and HTTP server settings described in [Agent link setup](agent-links.md).

The v2.6.0 updater was disabled by default; users who enabled it must disable or remove their installed copy to stop it from applying future release backups.
Omitting it from this distribution does not disable it in an existing profile.
