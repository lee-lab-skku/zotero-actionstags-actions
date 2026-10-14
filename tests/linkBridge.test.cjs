const assert = require('node:assert/strict');
const { test } = require('node:test');
const { run, start, selection } = require('./helpers/link-bridge.cjs');

test('agent selection uses API once, returns raw labels and escaped HTML, and leaves clipboard/UI untouched', async () => {
    const env = await start();
    env.Zotero.getActiveZoteroPane = () => assert.fail('UI selection read by agent');
    const result = await env.request({ ...selection, itemKeys: ['ITEM0001', 'PDF00001', 'ITEM0001'] });
    assert.equal(result.status, 200);
    assert.deepEqual(result.links, [{ uri: 'zotero://select/library/items/ITEM0001', label: 'Smith26',
        html: '<a href="zotero://select/library/items/ITEM0001">Smith26</a>' }]);
    assert.equal(env.calls.length, 1);
    assert.equal(env.calls[0][1].itemID, undefined);
    assert.deepEqual([...env.calls[0][1].itemIDs], [1, 2]);
    assert.deepEqual(env.copied, []);
    assert.equal(env.Zotero.ActionLinkBridge.active, null);
});

test('explicit collections and group IDs resolve without switching the active library', async () => {
    const env = await start();
    const own = await env.request({ ...selection, collectionKey: 'COLL0001' });
    assert.match(own.links[0].uri, /collections\/COLL0001/);
    const group = await env.request({ ...selection, library: { type: 'group', id: 100 } });
    assert.equal(group.links[0].uri, 'zotero://select/groups/100/items/ITEM0001');
    assert.equal(group.links[0].label, 'Smith26');
});

test('annotation and note links preserve page, parent labels, escaping, and per-item API arguments', async () => {
    const env = await start();
    const annotation = await env.request({ ...selection, action: 'copyAnnotationLink', itemKeys: ['ANN00001'] });
    assert.equal(annotation.links[0].uri, 'zotero://open-pdf/library/items/PDF00001?page=3&annotation=ANN00001');
    assert.equal(annotation.links[0].label, 'a < b & c... (Smith26)');
    assert.match(annotation.links[0].html, /a &lt; b &amp; c/);
    const note = await env.request({ ...selection, action: 'copyNoteLink', itemKeys: ['NOTE0001'] });
    assert.equal(note.links[0].uri, 'zotero://note/u/NOTE0001/');
    assert.equal(note.links[0].label, 'Title < & > (Smith26)');
    assert.match(note.links[0].html, /Title &lt; &amp; &gt;/);
    assert.equal(env.calls[0][1].itemID, 3);
    assert.equal(env.calls[1][1].itemID, 4);
    assert.equal(env.calls[0][1].itemIDs, undefined);
    assert.deepEqual(env.copied, []);
});

test('validation and authorization refuse unsupported, missing, deleted, disabled, and browser requests', async () => {
    const env = await start();
    for (const data of [null, { ...selection, action: 'unsupportedAction' }, { ...selection, itemKeys: [] },
        { ...selection, itemKeys: ['bad'] }, { ...selection, library: { type: 'group', id: 7 } },
        { ...selection, action: 'copyNoteLink', collectionKey: 'COLL0001' }])
        assert.equal((await env.request(data)).status, 400);
    assert.equal((await env.request(selection, { 'x-action-link-token': 'wrong' })).status, 403);
    assert.equal((await env.request(selection, { origin: 'https://example.com' })).status, 403);
    assert.equal((await env.request({ ...selection, itemKeys: ['MISSING1'] })).status, 404);
    env.targets[0].deleted = true;
    assert.equal((await env.request(selection)).status, 404);
    env.targets[0].deleted = false;
    env.actions.copySelectionLink.enabled = false;
    assert.equal((await env.request(selection)).status, 503);
    env.actions.linkBridge.enabled = false;
    assert.equal((await env.request(selection)).status, 503);
    assert.equal(env.calls.length, 0);
});

test('action failures and lost results are structured, without partial success or a stuck context', async () => {
    const env = await start();
    env.targets[2].annotationPosition = 'broken';
    const invalid = await env.request({ ...selection, action: 'copyAnnotationLink', itemKeys: ['ANN00001'] });
    assert.equal(invalid.error.code, 'INVALID_POSITION');
    assert.equal(invalid.status, 422);
    delete env.Zotero.BetterNotes;
    const missing = await env.request({ ...selection, action: 'copyNoteLink', itemKeys: ['NOTE0001'] });
    assert.equal(missing.error.code, 'BETTER_NOTES_UNAVAILABLE');
    const dispatch = env.Zotero.ActionsTags.api.actionManager.dispatchActionByKey;
    env.Zotero.ActionsTags.api.actionManager.dispatchActionByKey = async () => {};
    assert.equal((await env.request(selection)).error.code, 'MISSING_RESULT');
    env.Zotero.ActionsTags.api.actionManager.dispatchActionByKey = dispatch;
    env.targets[0].getField = () => { throw new Error('field failed'); };
    assert.equal((await env.request(selection)).error.code, 'ACTION_FAILED');
    env.targets[0].getField = () => 'Recovered';
    assert.equal((await env.request(selection)).status, 200);
    env.Zotero.BetterNotes = { api: { convert: { note2link: () => 'zotero://note/u/NOTE0001' } } };
    const partial = await env.request({ ...selection, action: 'copyNoteLink', itemKeys: ['NOTE0001', 'ITEM0001'] });
    assert.equal(partial.status, 422);
    assert.equal(partial.links, undefined);
    assert.equal(env.Zotero.ActionLinkBridge.active, null);
});

test('concurrent requests are rejected and an interleaved menu call is not captured', async () => {
    const env = await start();
    const original = env.Zotero.ActionsTags.api.actionManager.dispatchActionByKey;
    let unblock, entered;
    const waiting = new Promise(resolve => { entered = resolve; });
    env.Zotero.ActionsTags.api.actionManager.dispatchActionByKey = async (...args) => {
        entered(); await new Promise(resolve => { unblock = resolve; }); await original(...args);
    };
    const first = env.request(selection);
    await waiting;
    assert.equal((await env.request(selection)).status, 409);
    await run('copySelectionLink', env, { items: [env.targets[0]], triggerType: 'menu' });
    assert.equal(env.copied.at(-1), 'copy');
    unblock();
    assert.equal((await first).status, 200);
    assert.equal((await env.request(selection, { 'x-action-link-token': 'wrong' })).status, 403);
});

test('result receivers match action and targets, and duplicate results are refused', async () => {
    const env = await start();
    const original = env.Zotero.ActionsTags.api.actionManager.dispatchActionByKey;
    env.Zotero.ActionsTags.api.actionManager.dispatchActionByKey = async (action, args) => {
        const bridge = env.Zotero.ActionLinkBridge;
        assert.equal(bridge.capture('copyNoteLink', env.targets[0], [], null, 'unknown'), null);
        assert.equal(bridge.capture(action, null, [env.targets[1]], null, 'unknown'), null);
        assert.equal(bridge.capture(action, null, [env.targets[0]], env.collection, 'unknown'), null);
        await original(action, args);
        bridge.capture(action, null, [env.targets[0]], null, 'unknown').complete([]);
    };
    assert.equal((await env.request(selection)).error.code, 'DUPLICATE_RESULT');
});

test('startup reuses the token and shutdown listener, replaces its endpoint, and leaves the shared server intact', async () => {
    const env = await start();
    const token = env.prefs.get('actionsTags.actions.linkBridgeToken');
    const previous = env.Zotero.ActionLinkBridge;
    const endpoint = env.Zotero.Server.Endpoints['/action-links'];
    env.Zotero.Server.Endpoints['/other'] = class {};
    await run('linkBridge', env);
    assert.equal(previous.disposed, true);
    assert.equal(env.prefs.get('actionsTags.actions.linkBridgeToken'), token);
    assert.notEqual(env.Zotero.Server.Endpoints['/action-links'], endpoint);
    assert.equal(env.shutdown.length, 1);
    assert.equal((await env.request(selection)).status, 200);
    env.shutdown[0]();
    assert.equal(env.Zotero.ActionLinkBridge, undefined);
    assert.equal(env.Zotero.Server.Endpoints['/action-links'], undefined);
    assert.ok(env.Zotero.Server.Endpoints['/other']);
});
