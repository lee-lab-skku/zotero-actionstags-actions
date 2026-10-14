const Zotero = require('Zotero');
const DEFAULT_REPOSITORY = 'lee-lab-skku/zotero-actionstags-actions';
const PREF_KEY = 'actionsTags.actions.versionTag';

async function getJSON(url) {
    const response = await Zotero.HTTP.request('GET', url, {
        responseType: 'json', timeout: 30000, errorDelayMax: 0,
    });
    return response.response;
}

const manager = Zotero.ActionsTags.api.actionManager;
const installed = manager.getActions('updateActions');
const repository = installed?.repository ?? DEFAULT_REPOSITORY;
if (typeof repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)
    || repository.split('/').some(part => part === '.' || part === '..'))
    throw new Error('Invalid source repository; expected GitHub owner/repo.');
const latest = await getJSON(`https://api.github.com/repos/${repository}/releases/latest`);
if (!latest || typeof latest.tag_name !== 'string' || !latest.tag_name || !Array.isArray(latest.assets))
    throw new Error('GitHub returned an invalid release.');
const latestVersion = latest.tag_name;
// Imported action metadata identifies the installation independently of old update records.
const installedVersion = installed?.releaseVersion;
const prevVersion = typeof installedVersion === 'string' && installedVersion
    ? installedVersion : Zotero.Prefs.get(PREF_KEY);
if (prevVersion === latestVersion)
    return;

const asset = latest.assets.find(asset => asset.name === 'actions-zotero.json');
if (!asset?.browser_download_url?.startsWith(`https://github.com/${repository}/releases/download/`))
    return 'This release has no JSON action backup. Import its YAML file manually.';
const backup = await getJSON(asset.browser_download_url);
if (backup?.type !== 'ActionsTagsBackup' || !backup.actions
    || typeof backup.actions !== 'object' || Array.isArray(backup.actions)
    || !Object.keys(backup.actions).length)
    throw new Error('The release does not contain a valid action backup.');

const entries = Object.entries(backup.actions);
// Validate the whole backup before changing any installed action.
for (const [key, action] of entries) {
    if (!key || !action || typeof action !== 'object' || Array.isArray(action)
        || !Number.isInteger(action.event) || action.event < 0
        || !Number.isInteger(action.operation) || action.operation < 0 || action.operation > 5
        || typeof action.data !== 'string')
        throw new Error('Invalid action in release: ' + key);
}

let updated = 0;
for (const [key, action] of entries) {
    const previous = manager.getActions(key);
    // Keep user choices while updating action code and metadata.
    const replacement = { ...action };
    if (previous) {
        for (const setting of ['enabled', 'shortcut'])
            if (Object.hasOwn(previous, setting))
                replacement[setting] = previous[setting];
    }
    if (JSON.stringify(previous) !== JSON.stringify(replacement)) {
        await manager.updateAction(replacement, key);
        updated++;
    }
}
// Failed downloads or writes leave the previous tag intact, allowing a retry.
Zotero.Prefs.set(PREF_KEY, latestVersion);
return `Updated ${updated} actions to ${latestVersion}.`;
