const Zotero = require('Zotero');
const Services = require('Services');

// Startup scripts receive no item context. Filter menu follow-up calls at dispatch.
const guardKey = 'checkVPN';
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

    const protocol = Zotero.Prefs.get('sync.storage.protocol');
    if (protocol !== 'webdav')
        return;
    const host = Zotero.Prefs.get('sync.storage.url');
    if (!host)
        return;
    const scheme = Zotero.Prefs.get('sync.storage.scheme') || 'https';
    if (!['http', 'https'].includes(scheme))
        return 'The WebDAV URL scheme must be http or https.';

    try {
        // Any HTTP response proves reachability, including an authentication challenge.
        const response = await Zotero.HTTP.request('HEAD', `${scheme}://${host}`, {
            timeout: 5000,
            successCodes: false,
            errorDelayMax: 0,
        });
        if (!response.status)
            throw new Error('No HTTP response received.');
    } catch (_) {
        Services.prompt.alert(null, 'Check VPN or network',
            "The WebDAV server could not be reached. Check your VPN, network, and server settings.\nYour local library might not be up to date.");
    }
} finally {
    guardState.running.delete(guardKey);
}
