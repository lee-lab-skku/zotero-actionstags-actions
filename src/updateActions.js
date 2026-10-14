const Zotero = require('Zotero');
const Services = require('Services');

// Startup scripts receive no item context. Filter menu follow-up calls at dispatch.
const guardKey = 'updateActions';
const guardSymbol = Symbol.for('lee-lab-skku.actions.selectionGuard');
const guardState = Zotero[guardSymbol] ||= { menuKeys: new Set(), running: new Set() };
guardState.menuKeys.add(guardKey);
const guardManager = Zotero.ActionsTags?.api?.actionManager;
const previousDispatch = guardManager?.dispatchActionByKey;
if (typeof previousDispatch === 'function' && !previousDispatch[guardSymbol]) {
    const guardedDispatch = function(key, args, ...rest) {
        if (guardState.menuKeys.has(key) && args?.triggerType === 'menu' && args.itemID != null)
            return;
        return previousDispatch.call(this, key, args, ...rest);
    };
    guardedDispatch[guardSymbol] = true;
    guardManager.dispatchActionByKey = guardedDispatch;
}
if (guardState.running.has(guardKey)) return;
guardState.running.add(guardKey);
try {
    const DEFAULT_REPOSITORY = 'lee-lab-skku/zotero-actionstags-actions';
    const PREF_KEY = 'actionsTags.actions.versionTag';
    const PRERELEASE_KEY = 'actionsTags.actions.includePrereleases';

    function parseVersion(value) {
        if (typeof value !== 'string') return null;
        // Git build suffixes identify the build, not a SemVer prerelease.
        const tag = value.replace(/-\d+-g[0-9a-f]+(?:-dirty)?$/, '');
        const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(tag);
        if (!match) return null;
        const prerelease = match[4]?.split('.') || [];
        if (prerelease.some(part => /^0\d+$/.test(part))) return null;
        return { core: match.slice(1, 4).map(value => BigInt(value)), prerelease };
    }

    function compareVersions(a, b) {
        for (let i = 0; i < 3; i++) {
            if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i] ? 1 : -1;
        }
        if (!a.prerelease.length || !b.prerelease.length)
            return Number(!a.prerelease.length) - Number(!b.prerelease.length);
        for (let i = 0; i < Math.max(a.prerelease.length, b.prerelease.length); i++) {
            const left = a.prerelease[i], right = b.prerelease[i];
            if (left === right) continue;
            if (left === undefined || right === undefined) return left === undefined ? -1 : 1;
            const leftNumeric = /^\d+$/.test(left), rightNumeric = /^\d+$/.test(right);
            if (leftNumeric && rightNumeric) return BigInt(left) > BigInt(right) ? 1 : -1;
            if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
            return left > right ? 1 : -1;
        }
        return 0;
    }

    async function getJSON(url) {
        const response = await Zotero.HTTP.request('GET', url, {
            responseType: 'json', timeout: 30000, errorDelayMax: 0,
            headers: { Accept: 'application/vnd.github+json' },
        });
        return response.response;
    }

    async function findCandidates(repository, current, includePrereleases) {
        const candidates = [];
        for (let page = 1; ; page++) {
            const releases = await getJSON(`https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`);
            if (!Array.isArray(releases)) throw new Error('GitHub returned an invalid release list.');
            for (const release of releases) {
                if (!release || release.draft || (release.prerelease && !includePrereleases)) continue;
                const version = parseVersion(release.tag_name);
                if (version && compareVersions(version, current) > 0 && Array.isArray(release.assets))
                    candidates.push({ release, version });
            }
            if (releases.length < 100) break;
        }
        return candidates.sort((a, b) => compareVersions(b.version, a.version)).map(entry => entry.release);
    }

    function validateBackup(backup, repository, version) {
        if (backup?.type !== 'ActionsTagsBackup' || !backup.actions
            || typeof backup.actions !== 'object' || Array.isArray(backup.actions)
            || !Object.keys(backup.actions).length)
            throw new Error('The release does not contain a valid action backup.');
        if (backup.version !== undefined && backup.version !== version)
            throw new Error('Backup version does not match the selected release.');
        if (backup.repository !== undefined && backup.repository.toLowerCase?.() !== repository.toLowerCase())
            throw new Error('Backup source does not match the installed repository.');
        const entries = Object.entries(backup.actions);
        for (const [key, action] of entries) {
            if (!key || !action || typeof action !== 'object' || Array.isArray(action)
                || !Number.isInteger(action.event) || action.event < 0
                || !Number.isInteger(action.operation) || action.operation < 0 || action.operation > 5
                || typeof action.data !== 'string')
                throw new Error('Invalid action in release: ' + key);
        }
        // Promote the updater's installed version only after the other writes succeed.
        return entries.sort(([a], [b]) => Number(a === 'updateActions') - Number(b === 'updateActions'));
    }

    const manager = Zotero.ActionsTags.api.actionManager;
    const installed = manager.getActions('updateActions');
    const repository = installed?.repository ?? DEFAULT_REPOSITORY;
    if (typeof repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)
        || repository.split('/').some(part => part === '.' || part === '..'))
        throw new Error('Invalid source repository; expected GitHub owner/repo.');
    const installedVersion = installed?.releaseVersion || Zotero.Prefs.get(PREF_KEY);
    const current = parseVersion(installedVersion);
    if (!current) return 'Installed version is unknown. Import a versioned YAML backup first.';
    const candidates = await findCandidates(repository, current, Zotero.Prefs.get(PRERELEASE_KEY) === true);
    if (!candidates.length) return;

    const selected = { value: 0 };
    const choices = ['Not now', ...candidates.map(release => {
        const kind = release.prerelease ? 'prerelease' : 'stable';
        const manual = release.assets.some(asset => asset.name === 'actions-zotero.json') ? '' : ' — manual YAML import';
        return `${release.tag_name} (${kind})${manual}`;
    })];
    if (!Services.prompt.select(Zotero.getMainWindow(), 'Action updates',
        `Source: ${repository}\nInstalled: ${installedVersion}\nChoose a newer release to install:`, choices, selected)
        || selected.value === 0) return;
    const release = candidates[selected.value - 1];
    if (!release) return;
    const asset = release.assets.find(asset => asset.name === 'actions-zotero.json');
    if (!asset?.browser_download_url?.startsWith(`https://github.com/${repository}/releases/download/`))
        return 'This release has no JSON action backup. Import its YAML file manually.';
    const backup = await getJSON(asset.browser_download_url);
    const entries = validateBackup(backup, repository, release.tag_name);
    let updated = 0;
    for (const [key, action] of entries) {
        const previous = manager.getActions(key);
        const replacement = { ...action };
        if (previous) {
            for (const setting of ['enabled', 'shortcut'])
                if (Object.hasOwn(previous, setting)) replacement[setting] = previous[setting];
        }
        if (JSON.stringify(previous) !== JSON.stringify(replacement)) {
            await manager.updateAction(replacement, key);
            updated++;
        }
    }
    // Failed downloads or writes leave the previous tag intact, allowing a retry.
    Zotero.Prefs.set(PREF_KEY, release.tag_name);
    return `Updated ${updated} actions to ${release.tag_name}.`;
} finally {
    guardState.running.delete(guardKey);
}
