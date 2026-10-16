// Disposable-profile startup action. The profile builder injects trialActions.
const Zotero = require('Zotero');
const Services = require('Services');
const Components = require('Components');
const { AddonManager } = require('ChromeUtils').importESModule('resource://gre/modules/AddonManager.sys.mjs');
async function runTrial() {
    const report = { checks: [], versions: {} };
    const reportFile = Services.dirsvc.get('ProfD', Components.interfaces.nsIFile);
    reportFile.append('link-bridge-report.json');
    const check = (condition, message) => {
        if (!condition) throw new Error(message);
        report.checks.push(message);
    };
    try {
        await Promise.all([Zotero.initializationPromise, Zotero.unlockPromise, Zotero.uiReadyPromise]);
        for (let attempt = 0; attempt < 100 && !Zotero.ActionsTags?.api; attempt++)
            await Zotero.Promise.delay(100);
        const manager = Zotero.ActionsTags.api.actionManager;
        report.versions.zotero = Zotero.version;
        report.versions.actionsTags = (await AddonManager.getAddonByID('zoterotag@euclpts.com')).version;
        const backup = trialActions;
        check(Object.keys(backup.actions).every(key => manager.getActions(key)?.data === backup.actions[key].data),
            'persisted action definitions loaded');
        // The bridge precedes this fixture in the real A&T startup event sequence.
        check(!!Zotero.Server.Endpoints['/action-links'], 'startup event registers endpoint');
        const token = Zotero.Prefs.get('actionsTags.actions.linkBridgeToken');
        check(typeof token === 'string' && token.length === 64, 'profile token generated');
        const item = new Zotero.Item('journalArticle');
        item.libraryID = Zotero.Libraries.userLibraryID;
        item.setField('title', 'Bridge fixture < & >');
        await item.saveTx();
        const collection = new Zotero.Collection();
        collection.libraryID = item.libraryID;
        collection.name = 'Bridge fixture';
        await collection.saveTx();
        item.addToCollection(collection.id);
        await item.saveTx();
        const note = new Zotero.Item('note');
        note.libraryID = item.libraryID;
        note.parentID = item.id;
        note.setNote('<p>Fixture note &amp; title</p>');
        await note.saveTx();
        const pdf = new Zotero.Item('attachment');
        pdf.libraryID = item.libraryID;
        pdf.parentID = item.id;
        pdf.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
        pdf.attachmentContentType = 'application/pdf';
        pdf.attachmentPath = 'storage:fixture.pdf';
        await pdf.saveTx();
        const annotation = new Zotero.Item('annotation');
        annotation.libraryID = item.libraryID;
        annotation.parentID = pdf.id;
        annotation.annotationType = 'highlight';
        annotation.annotationText = ' One  two\nthree four five six seven eight <&> ';
        annotation.annotationColor = '#ffd400';
        annotation.annotationSortIndex = '00002|000000|00000';
        annotation.annotationPosition = JSON.stringify({ pageIndex: 2, rects: [[0, 0, 10, 10]] });
        await annotation.saveTx();
        const request = async (body, auth = token) => {
            const xhr = await Zotero.HTTP.request('POST', 'http://127.0.0.1:23129/action-links', {
                body: JSON.stringify(body), successCodes: false,
                headers: { 'Content-Type': 'application/json', 'X-Action-Link-Token': auth,
                    'User-Agent': 'ActionLinkTrial/1.0' },
            });
            return { status: xhr.status, data: JSON.parse(xhr.responseText) };
        };
        const selection = { action: 'copySelectionLink', library: { type: 'user' }, itemKeys: [item.key, pdf.key] };
        const selected = await request(selection);
        check(selected.status === 200 && selected.data.links.length === 1, 'real HTTP selection resolves and deduplicates parent');
        check(selected.data.links[0].uri === `zotero://select/library/items/${item.key}`, 'selection uses library scope');
        check(selected.data.links[0].label === 'Bridge fixture < & >' && selected.data.links[0].html.includes('&lt; &amp; &gt;'), 'raw title and escaped HTML returned');
        const scoped = await request({ ...selection, collectionKey: collection.key });
        check(scoped.status === 200 && scoped.data.links[0].uri.includes(`/collections/${collection.key}/`), 'explicit collection resolved');
        const annotated = await request({ ...selection, action: 'copyAnnotationLink', itemKeys: [annotation.key] });
        check(annotated.status === 200 && annotated.data.links[0].uri === `zotero://open-pdf/library/items/${pdf.key}?page=3&annotation=${annotation.key}`, 'real PDF annotation key and page returned');
        const defaultPreview = annotated.data.links[0];
        check(defaultPreview.itemKey === annotation.key && defaultPreview.wordRange.start === 0
            && defaultPreview.wordRange.end === 8 && defaultPreview.wordRange.totalWords === 9
            && defaultPreview.label.startsWith('One  two\nthree four five six seven eight... ('),
            'default annotation preview counts words and preserves internal whitespace');
        const ranged = await request({ ...selection, action: 'copyAnnotationLink', itemKeys: [annotation.key],
            wordRanges: { [annotation.key]: { start: 7 } } });
        check(ranged.status === 200 && ranged.data.links[0].wordRange.start === 7
            && ranged.data.links[0].wordRange.end === 9 && ranged.data.links[0].wordRange.totalWords === 9
            && ranged.data.links[0].label.startsWith('... eight <&> (')
            && ranged.data.links[0].html.includes('eight &lt;&amp;&gt;'),
            'real annotation word range returns applied metadata and escaped text');
        const outOfBounds = await request({ ...selection, action: 'copyAnnotationLink', itemKeys: [annotation.key],
            wordRanges: { [annotation.key]: { start: 9 } } });
        check(outOfBounds.status === 422 && outOfBounds.data.error.code === 'WORD_RANGE_OUT_OF_BOUNDS',
            'real annotation rejects out-of-bounds word range');
        check((await request(selection, 'wrong-token')).status === 403, 'invalid token rejected');
        check((await request({ ...selection, itemKeys: ['ZZZZZZZZ'] })).status === 404, 'missing item rejected');
        check((await request({ ...selection, action: 'copyAnnotationLink' })).status === 422, 'invalid annotation target rejected');
        const noteResult = await request({ ...selection, action: 'copyNoteLink', itemKeys: [note.key] });
        if (Zotero.BetterNotes?.api) {
            check(noteResult.status === 200 && noteResult.data.links[0].uri.startsWith('zotero://note/'), 'real Better Notes conversion returned');
        } else {
            check(noteResult.status === 422 && noteResult.data.error.code === 'BETTER_NOTES_UNAVAILABLE', 'missing optional Better Notes rejected');
        }
        manager.updateAction({ ...manager.getActions('copySelectionLink'), enabled: false }, 'copySelectionLink');
        check((await request(selection)).status === 503, 'disabled action rejected');
        manager.updateAction(backup.actions.copySelectionLink, 'copySelectionLink');
        const previous = Zotero.ActionLinkBridge;
        await manager.dispatchActionByKey('linkBridge', { triggerType: 8 });
        check(previous.disposed && Zotero.Prefs.get('actionsTags.actions.linkBridgeToken') === token, 'startup rerun replaces bridge and retains token');
        check((await request(selection)).status === 200, 'request recovers after errors and bridge replacement');
        Zotero.ActionLinkBridge.dispose();
        check(!Zotero.Server.Endpoints['/action-links'] && Zotero.Server.Endpoints['/connector/ping'], 'dispose leaves shared server endpoints intact');
        report.ok = true;
    } catch (error) {
        report.ok = false;
        report.error = { message: error.message, stack: error.stack };
    }
    await Zotero.File.putContentsAsync(reportFile.path, JSON.stringify(report, null, 2));
    Services.startup.quit(Components.interfaces.nsIAppStartup.eAttemptQuit, report.ok ? 0 : 1);
}
await runTrial();
