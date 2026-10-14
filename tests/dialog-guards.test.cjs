const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compileAction } = require('./helpers/action-runner.cjs');
const { test } = require('node:test');

function environment() {
    const prefs = new Map([
        ['sync.storage.protocol', 'webdav'], ['sync.storage.scheme', 'https'], ['sync.storage.url', 'dav.example'],
    ]);
    const counts = { question: 0, alert: 0, selection: 0, http: 0, other: 0 };
    const Zotero = {
        Prefs: { get: key => prefs.get(key), set: (key, value) => prefs.set(key, value) },
        Groups: { getAll: () => [] }, getMainWindow: () => null,
        HTTP: { request: async (method, url) => {
            counts.http++;
            return { response: [
                { tag_name: 'v1.1.0', assets: [{ name: 'actions-zotero.json' }] },
            ], status: 0 };
        } },
    };
    const Services = { prompt: {
        BUTTON_POS_0: 1, BUTTON_POS_1: 256, BUTTON_TITLE_NO: 4, BUTTON_TITLE_YES: 3, BUTTON_POS_0_DEFAULT: 0,
        confirmEx: () => { counts.question++; return 0; },
        alert: () => { counts.alert++; },
        select: () => { counts.selection++; return false; },
    } };
    const originals = [];
    const source = key => fs.readFileSync(path.join(__dirname, '..', 'src', key + '.js'), 'utf8');
    // Match A&T 2.6.2's event-8 script inputs: require and triggerType, no item/items.
    const run = (key, triggerType = 8) => {
        let body = source(key);
        if (key === 'updateActions') body = body.replace('const INSTALLED_VERSION = null;', 'const INSTALLED_VERSION = "v1.0.0";');
        return compileAction(key, body)({ Zotero, Services }, { triggerType });
    };
    const manager = {
        getActions: () => ({ releaseVersion: 'v1.0.0', repository: 'example/actions' }),
        async dispatchActionByKey(key, args) {
            assert.equal(this, manager);
            originals.push({ key, args });
            if (key === 'other') { counts.other++; return 'forwarded'; }
            return run(key, args.triggerType);
        },
    };
    Zotero.ActionsTags = { api: { actionManager: manager } };
    // A&T menu command: selection-level call, followed by each selected item.
    async function menu(key, ids) {
        await manager.dispatchActionByKey(key, { itemIDs: ids, triggerType: 'menu' });
        for (const itemID of ids)
            await manager.dispatchActionByKey(key, { itemID, triggerType: 'menu' });
    }
    return { Zotero, Services, prefs, counts, manager, originals, run, menu };
}

for (const [key, countKey] of [['setPreferences', 'question'], ['checkVPN', 'alert'], ['updateActions', 'selection']]) {
    test(`${key} runs once per menu selection and permits the next explicit command`, async () => {
        const env = environment();
        await env.menu(key, [1, 2]);
        assert.equal(env.counts[countKey], 1);
        assert.equal(env.originals.length, 1);
        const wrapped = env.manager.dispatchActionByKey;
        await env.menu(key, [1]);
        assert.equal(env.counts[countKey], 2);
        assert.equal(env.originals.length, 2);
        assert.equal(env.manager.dispatchActionByKey, wrapped, 'Do not accumulate wrappers');
    });
}

test('selection guard leaves other actions and non-menu calls unchanged', async () => {
    const env = environment();
    await env.menu('checkVPN', [1]);
    await env.menu('other', [1, 2]);
    assert.equal(env.counts.other, 3);
    const args = { itemID: 1, triggerType: 'unknown' };
    await env.manager.dispatchActionByKey('checkVPN', args);
    assert.equal(env.originals.at(-1).args, args);
    assert.equal(env.counts.alert, 2);
});

test('one dispatcher wrapper supports the three guarded actions independently', async () => {
    const env = environment();
    await env.menu('checkVPN', [1]);
    const wrapped = env.manager.dispatchActionByKey;
    await env.menu('setPreferences', [1]);
    await env.menu('updateActions', [1]);
    assert.equal(env.manager.dispatchActionByKey, wrapped);
    assert.equal(env.counts.alert, 1);
    assert.equal(env.counts.question, 1);
    assert.equal(env.counts.selection, 1);
});

test('overlapping VPN checks are suppressed and later checks can run again', async () => {
    const env = environment();
    let finish;
    env.Zotero.HTTP.request = () => { env.counts.http++; return new Promise(resolve => { finish = resolve; }); };
    const first = env.run('checkVPN');
    await env.run('checkVPN', 'menu');
    assert.equal(env.counts.http, 1);
    finish({ status: 0 });
    await first;
    env.Zotero.HTTP.request = async () => { env.counts.http++; return { status: 0 }; };
    await env.run('checkVPN');
    assert.equal(env.counts.http, 2);
    assert.equal(env.counts.alert, 2);
});

test('update failure and preference prompt failure release their running guards', async () => {
    const env = environment();
    env.Zotero.HTTP.request = async () => { throw Error('offline'); };
    await assert.rejects(env.run('updateActions'), /offline/);
    env.Zotero.HTTP.request = async () => ({ response: [] });
    await env.run('updateActions');
    env.Services.prompt.confirmEx = () => { throw Error('prompt failed'); };
    await assert.rejects(env.run('setPreferences'), /prompt failed/);
    env.Services.prompt.confirmEx = () => { env.counts.question++; return 0; };
    await env.run('setPreferences');
    assert.equal(env.counts.question, 1);
});
