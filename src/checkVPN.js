if (Zotero.Prefs.get('sync.storage.protocol') === 'webdav') {
    const r = await Promise.race([fetch("https://" + Zotero.Prefs.get('sync.storage.url')), new Promise(_ => setTimeout(_, 5000))]);
    if (typeof r === 'undefined') {
        Services.prompt.alert(null, "Turn on VPN", "It seems your library is synced with WebDAV, but we can't reach the server.\nNote that your contents might not be the latest.");
    }
}