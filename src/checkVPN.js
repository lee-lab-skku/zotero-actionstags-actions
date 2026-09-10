const Zotero = require('Zotero');
const Services = require('Services');

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
