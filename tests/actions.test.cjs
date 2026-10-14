const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourceDir = path.join(__dirname, '..', 'src');
async function run(name, globals, args = {}) {
    const context = vm.createContext({
        require: key => {
            assert.ok(key in globals, `Unexpected global: ${key}`);
            return globals[key];
        },
        item: null, items: [], collection: false, ...args,
    });
    return new vm.Script(`(async () => {${fs.readFileSync(path.join(sourceDir, name + '.js'), 'utf8')}\n})()`)
        .runInContext(context);
}

function deleteEnvironment() {
    const listeners = new Map();
    const calls = [];
    const errors = [];
    const action = { enabled: true };
    const selection = { items: [{ deleted: false, isAnnotation: () => false }] };
    const target = { inTree: true, isContentEditable: false, closest: () => false };
    const window = {
        document: { getElementById: id => {
            assert.equal(id, 'zotero-items-tree');
            return { contains: node => !!node?.inTree };
        } },
        Zotero_Tabs: { selectedType: 'library' },
        ZoteroPane: {
            getCollectionTreeRows: () => [{ isCollection: () => true }],
            getSelectedItems: () => assert.fail('Tab-dependent pane selection getter used'),
            itemsView: {
                selection: { get selected() { return new Set(selection.items.map((_, index) => index)); } },
                getRow: index => ({ ref: selection.items[index] }),
            },
            deleteSelectedItems: async (...args) => { calls.push(args); },
        },
        addEventListener: (type, fn, capture) => {
            if (type === 'keydown') assert.equal(capture, true);
            assert.ok(!listeners.has(type));
            listeners.set(type, fn);
        },
        removeEventListener: (type, fn) => {
            assert.equal(listeners.get(type), fn);
            listeners.delete(type);
        },
    };
    const Zotero = {
        ActionsTags: { api: { actionManager: { getActions: key => {
            assert.equal(key, 'trashOnDelete');
            return action;
        } } } },
        logError: error => errors.push(error),
    };
    function press(overrides = {}) {
        const event = { key: 'Delete', target,
            preventDefault() { this.prevented = true; },
            stopImmediatePropagation() { this.stopped = true; }, ...overrides };
        listeners.get('keydown')(event);
        return event;
    }
    return { window, Zotero, action, selection, target, listeners, calls, errors, press };
}

const flushDelete = () => new Promise(resolve => setImmediate(resolve));

test('collection Delete blocks native removal and invokes confirmed Zotero trash once', async () => {
    const env = deleteEnvironment();
    env.window.ZoteroPane.getCollectionTreeRows = () => [1, 2].map(() => ({ isCollection: () => true }));
    await run('trashOnDelete', env, { window: env.window });
    const event = env.press();
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
    env.press();
    await flushDelete();
    assert.deepEqual(env.calls, [[true, true]]);
    env.press({ repeat: true });
    await flushDelete();
    assert.equal(env.calls.length, 1);
});

test('collection Shift+Delete blocks native trash and invokes collection removal', async () => {
    const env = deleteEnvironment();
    await run('trashOnDelete', env, { window: env.window });
    const event = env.press({ shiftKey: true });
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
    await flushDelete();
    assert.deepEqual(env.calls, [[false, true]]);
    env.action.enabled = false;
    assert.equal(env.press({ shiftKey: true }).prevented, undefined);
    assert.equal(env.press().prevented, undefined);
    env.action.enabled = true;
    env.press();
    await flushDelete();
    assert.deepEqual(env.calls, [[false, true], [true, true]]);
});

test('collection Delete leaves editing, modified keys, and other contexts untouched', async () => {
    for (const change of [
        env => { env.action.enabled = false; },
        env => { delete env.Zotero.ActionsTags; },
        env => { env.window.Zotero_Tabs.selectedType = 'reader'; },
        env => { env.target.inTree = false; },
        env => { env.target.isContentEditable = true; },
        env => { env.target.closest = () => ({}); },
        env => { env.window.ZoteroPane.getCollectionTreeRows = () => []; },
        env => { env.window.ZoteroPane.getCollectionTreeRows = () => [true, false].map(value => ({ isCollection: () => value })); },
        env => { env.window.ZoteroPane.itemsView = null; },
        env => { env.selection.items = []; },
        env => { env.selection.items = [{ deleted: true }]; },
        env => { env.selection.items = [{ isAnnotation: () => true }]; },
    ]) {
        const env = deleteEnvironment();
        await run('trashOnDelete', env, { window: env.window });
        change(env);
        assert.equal(env.press().prevented, undefined);
        assert.equal(env.press({ shiftKey: true }).prevented, undefined);
        await flushDelete();
        assert.equal(env.calls.length, 0);
    }
    const env = deleteEnvironment();
    await run('trashOnDelete', env, { window: env.window });
    for (const override of [{ key: 'Backspace' }, ...['ctrlKey', 'altKey', 'metaKey', 'isComposing', 'defaultPrevented'].map(key => ({ [key]: true }))]) {
        assert.equal(env.press(override).prevented, undefined);
        assert.equal(env.press({ ...override, shiftKey: true }).prevented, undefined);
    }
});

test('collection Delete replaces listeners, cleans up, and recovers after a failure', async () => {
    const env = deleteEnvironment();
    await run('trashOnDelete', env, { window: env.window });
    await run('trashOnDelete', env, { window: env.window });
    const failure = new Error('Cannot trash');
    env.window.ZoteroPane.deleteSelectedItems = async () => { throw failure; };
    env.press();
    await flushDelete();
    assert.deepEqual(env.errors, [failure]);
    env.window.ZoteroPane.deleteSelectedItems = async (...args) => env.calls.push(args);
    env.press();
    await flushDelete();
    assert.equal(env.calls.length, 1);
    env.listeners.get('unload')();
    assert.equal(env.listeners.size, 0);
    assert.equal(env.window.__actionsTagsTrashOnDelete, undefined);
});

function linkEnvironment(collections = [], rows = collections) {
    const copied = [];
    class ClipboardHelper {
        addText(text, type) { copied.push([type, text]); }
        copy() { copied.push(['copy']); }
    }
    const Zotero = {
        Libraries: { get: id => id === 7 ? { libraryType: 'user' } : { libraryType: 'group', groupID: 100 } },
        getMainWindow: () => ({ Zotero_Tabs: { selectedType: 'library' } }),
        getActiveZoteroPane: () => ({
            getSelectedCollection: () => assert.fail('Removed singular API used'),
            getSelectedCollections: () => collections,
            getCollectionTreeRows: () => rows,
        }),
        ActionsTags: { api: { utils: { ClipboardHelper } } },
    };
    return { Zotero, copied };
}
function linkItem(overrides = {}) {
    return { id: 1, key: 'ITEM', libraryID: 7, isAttachment: () => false,
        isRegularItem: () => true, getCollections: () => [3],
        getField: () => 'a < b & c', ...overrides };
}

test('all action sources compile as Actions & Tags async function bodies', () => {
    for (const name of fs.readdirSync(sourceDir).filter(name => name.endsWith('.js')))
        new vm.Script(`(async function(item, items, collection, require) {${fs.readFileSync(path.join(sourceDir, name), 'utf8')}\n})`);
});

test('selection links support Z10 single, multiple, and mixed collection rows', async () => {
    const collection = { id: 3, key: 'COLL', libraryID: 7 };
    for (const [collections, rows, expected] of [
        [[collection], [collection], '/collections/COLL/'],
        [[collection, { id: 4 }], [collection, { id: 4 }], '/library/items/'],
        [[collection], [collection, { search: true }], '/library/items/'],
    ]) {
        const env = linkEnvironment(collections, rows);
        await run('copySelectionLink', env, { items: [linkItem()] });
        assert.ok(env.copied[0][1].includes(expected));
        assert.match(env.copied[1][1], /a &lt; b &amp; c/);
    }
});

test('selection links handle standalone attachments, reader context, and duplicate parents', async () => {
    const env = linkEnvironment([{ id: 3, key: 'COLL', libraryID: 7 }]);
    env.Zotero.getMainWindow = () => ({ Zotero_Tabs: { selectedType: 'reader' } });
    const parent = linkItem();
    const attachment = linkItem({ id: 2, isAttachment: () => true, parentItem: parent });
    const standalone = linkItem({ id: 3, key: 'FILE', isAttachment: () => true, isRegularItem: () => false });
    await run('copySelectionLink', env, { items: [parent, attachment, standalone] });
    assert.equal(env.copied[0][1], 'zotero://select/library/items/ITEM\nzotero://select/library/items/FILE');
});

test('selection links ignore foreign or non-member collections and per-item invocations', async () => {
    for (const collection of [{ id: 3, libraryID: 8 }, { id: 9, libraryID: 7 }]) {
        const env = linkEnvironment();
        await run('copySelectionLink', env, { collection, items: [linkItem()] });
        assert.equal(env.copied[0][1], 'zotero://select/library/items/ITEM');
    }
    const env = linkEnvironment();
    await run('copySelectionLink', env);
    await run('copySelectionLink', env, { item: linkItem(), items: [linkItem()] });
    assert.equal(env.copied.length, 0);
});

test('PDF links reject other item types and malformed page positions', async () => {
    const env = linkEnvironment();
    const item = { isAnnotation: () => true, parentItem: { isPDFAttachment: () => true } };
    for (const position of ['{', 'null', '{"pageIndex":-1}', '{}']) {
        assert.match(await run('copyAnnotationLink', env, { item: { ...item, annotationPosition: position } }), /valid PDF/);
    }
    assert.match(await run('copyAnnotationLink', env, { item: { isAnnotation: () => false } }), /Select an annotation/);
    assert.equal(env.copied.length, 0);
});

test('standalone Better Notes titles are escaped without requesting citation keys on notes', async () => {
    const env = linkEnvironment();
    const note = { isNote: () => true, isRegularItem: () => false,
        getField: field => { assert.equal(field, 'title'); return '<note>'; } };
    env.Zotero.Items = { getTopLevel: () => [note] };
    env.Zotero.BetterNotes = { api: { convert: { note2link: () => 'zotero://note/u/KEY/?line=1&ignore=1' } } };
    await run('copyNoteLink', env, { item: note });
    assert.match(env.copied[1][1], /&lt;note&gt;/);
    assert.match(env.copied[1][1], /&amp;ignore/);
});

function prefsEnvironment(values = {}) {
    const prefs = new Map(Object.entries(values));
    const Zotero = { Prefs: { get: key => prefs.get(key), set: (key, value) => prefs.set(key, value) } };
    return { Zotero, prefs };
}

test('preferences prompt for an organization despite legacy settings and initialize names with a string', async () => {
    const env = prefsEnvironment({ 'tara.groupID': 100 });
    const selections = [];
    const group = { id: 100, libraryID: 8 };
    env.Zotero.Groups = { get: id => id === 100 && group, getAll: () => [group] };
    env.Zotero.Collections = { getByLibrary: id => {
        assert.equal(id, 8); return [{ key: 'COLL', name: 'Review' }];
    } };
    env.Services = { prompt: {
        BUTTON_POS_0: 1, BUTTON_POS_1: 256, BUTTON_TITLE_NO: 4, BUTTON_TITLE_YES: 3, BUTTON_POS_0_DEFAULT: 0,
        confirmEx: (win, title, message, flags) => { assert.equal(flags, 772); return 0; },
        select: (win, title, message, choices, selected) => { selections.push(title); selected.value = 0; return true; },
        prompt: (win, title, message, input) => { assert.equal(input.value, ''); input.value = ' Reviewer '; return true; },
    } };
    await run('setPreferences', env);
    assert.equal(env.prefs.get('actionsTags.actions.groupID'), 100);
    assert.equal(env.prefs.get('actionsTags.actions.reviewerName'), 'Reviewer');
    assert.equal(env.prefs.get('actionsTags.actions.reviewCollectionKey'), 'COLL');
    assert.deepEqual(selections, ['Organization', 'Review']);
});

test('preferences reuse valid current settings without opening prompts', async () => {
    const env = prefsEnvironment({ 'actionsTags.actions.groupID': 100,
        'actionsTags.actions.reviewCollectionKey': 'REVIEW', 'actionsTags.actions.reviewerName': 'Reviewer',
        'actionsTags.actions.includePrereleases': false });
    const group = { id: 100, libraryID: 8 };
    const collection = { key: 'REVIEW', name: 'Review' };
    env.Zotero.Groups = { get: id => id === 100 && group,
        getAll: () => assert.fail('Existing group should be reused') };
    env.Zotero.Collections = { getByLibrary: () => [collection],
        getByLibraryAndKey: (id, key) => id === 8 && key === 'REVIEW' && collection };
    env.Services = { prompt: {
        select: () => assert.fail('Unexpected selection prompt'),
        prompt: () => assert.fail('Unexpected name prompt'),
    } };
    assert.equal(await run('setPreferences', env), undefined);
});

test('preferences handle no joined groups without opening an empty selector', async () => {
    const env = prefsEnvironment({ 'actionsTags.actions.includePrereleases': false });
    env.Zotero.Groups = { getAll: () => [] };
    env.Services = { prompt: { select: () => assert.fail('Empty selector') } };
    assert.match(await run('setPreferences', env), /Join and sync/);
});

test('WebDAV honors the configured scheme and warns on network failure or status zero', async () => {
    for (const result of [{ status: 401 }, { status: 0 }, new Error('offline')]) {
        const env = prefsEnvironment({ 'sync.storage.protocol': 'webdav', 'sync.storage.scheme': 'http', 'sync.storage.url': 'dav.example/path' });
        let alerts = 0;
        env.Services = { prompt: { alert: () => alerts++ } };
        env.Zotero.HTTP = { request: async (method, url, options) => {
            assert.equal(method, 'HEAD'); assert.equal(url, 'http://dav.example/path');
            assert.equal(options.timeout, 5000);
            if (result instanceof Error) throw result;
            return result;
        } };
        await run('checkVPN', env);
        assert.equal(alerts, result.status === 401 ? 0 : 1);
    }
});

function updateEnvironment({ invalid = false, fail = false, previousTag } = {}) {
    const env = prefsEnvironment(previousTag ? { 'actionsTags.actions.versionTag': previousTag } : {});
    env.Zotero.getMainWindow = () => null;
    env.Services = { prompt: { select: (win, title, message, choices, selected) => { selected.value = 1; return true; } } };
    const changes = [];
    const action = { event: 0, operation: 4, data: 'return;', enabled: true, shortcut: 'new' };
    const backup = { type: 'ActionsTagsBackup', actions: { first: action, second: invalid ? {} : action } };
    env.Zotero.HTTP = { request: async (method, url) => ({ response: url.includes('api.github.com')
        ? [{ tag_name: 'v2.0.0', assets: [{ name: 'actions-zotero.json', browser_download_url: 'https://github.com/lee-lab-skku/zotero-actionstags-actions/releases/download/v2.0.0/actions-zotero.json' }] }]
        : backup }) };
    env.Zotero.ActionsTags = { api: { actionManager: {
        getActions: key => ({ enabled: false, shortcut: 'user', ...(key === 'updateActions' ? { releaseVersion: previousTag || 'v1.0.0' } : {}) }),
        updateAction: async (action, key) => {
            if (fail && key === 'second') throw new Error('write failed');
            changes.push(action);
        },
    } } };
    return { ...env, changes };
}

test('updater applies initial updates and preserves user enable/shortcut choices', async () => {
    const env = updateEnvironment();
    await run('updateActions', env);
    assert.equal(env.changes.length, 2);
    assert.equal(env.changes[0].enabled, false);
    assert.equal(env.changes[0].shortcut, 'user');
    assert.equal(env.prefs.get('actionsTags.actions.versionTag'), 'v2.0.0');
});

test('updater follows the installed source repository including other owners', async () => {
    const env = updateEnvironment();
    const repository = 'example-lab/custom-actions';
    const manager = env.Zotero.ActionsTags.api.actionManager;
    const getActions = manager.getActions;
    manager.getActions = key => key === 'updateActions' ? { ...getActions(key), repository } : getActions(key);
    const request = env.Zotero.HTTP.request;
    const urls = [];
    env.Zotero.HTTP.request = async (method, url) => {
        urls.push(url);
        const result = await request(method, url);
        if (url.includes('api.github.com'))
            result.response[0].assets[0].browser_download_url = `https://github.com/${repository}/releases/download/v2.0.0/actions-zotero.json`;
        return result;
    };
    await run('updateActions', env);
    assert.deepEqual(urls, [`https://api.github.com/repos/${repository}/releases?per_page=100&page=1`,
        `https://github.com/${repository}/releases/download/v2.0.0/actions-zotero.json`]);
    assert.equal(env.changes.length, 2);
});

test('updater rejects malformed source paths before HTTP', async () => {
    const env = updateEnvironment();
    env.Zotero.ActionsTags.api.actionManager.getActions = () => ({ repository: '../actions' });
    env.Zotero.HTTP.request = () => assert.fail('Malformed repository must not be contacted');
    await assert.rejects(run('updateActions', env), /expected GitHub owner\/repo/);
    assert.equal(env.changes.length, 0);
});

test('updater validates the entire backup and does not advance version on failed writes', async () => {
    for (const options of [{ invalid: true }, { fail: true }]) {
        const env = updateEnvironment({ ...options, previousTag: 'v1.0.0' });
        await assert.rejects(run('updateActions', env));
        assert.equal(env.prefs.get('actionsTags.actions.versionTag'), 'v1.0.0');
        if (options.invalid) assert.equal(env.changes.length, 0);
    }
});

test('review notes use local dates and escape reviewer names, ignoring other libraries', async () => {
    const env = prefsEnvironment({ 'actionsTags.actions.groupID': 100,
        'actionsTags.actions.reviewCollectionKey': 'REVIEW', 'actionsTags.actions.reviewerName': '<Lee>&' });
    const saved = [];
    env.Zotero.Groups = { get: () => ({ libraryID: 8 }) };
    env.Zotero.Collections = { getByLibraryAndKey: () => ({ id: 10 }) };
    env.Zotero.Item = class {
        setNote(html) { this.html = html; }
        async saveTx() { saved.push(this); }
    };
    env.Services = { prompt: { select: (win, title, message, choices, selected) => {
        assert.equal(choices[0], '01-01'); assert.equal(choices.at(-1), '01-15');
        selected.value = 0; return true;
    } } };
    class LocalDate extends Date {
        constructor(...args) { super(...(args.length ? args : [2026, 0, 1, 0, 30])); }
        toISOString() { throw new Error('Do not format local review dates as UTC'); }
    }
    const item = { id: 1, libraryID: 8, isRegularItem: () => true,
        isEditable: () => true, getCollections: () => [10] };
    await run('reviewNote', env, { item, Date: LocalDate });
    assert.equal(saved[0].html, '<h1>260101 &lt;Lee&gt;&amp;</h1>');
    assert.equal(saved[0].parentID, 1);
    await run('reviewNote', env, { item: { ...item, libraryID: 7 } });
    assert.equal(saved.length, 1);
});

test('update download failure and unavailable JSON never change installed actions or version', async () => {
    for (const response of [new Error('HTTP 403'), [{ tag_name: 'v2.0.0', assets: [] }]]) {
        const env = updateEnvironment({ previousTag: 'v1.0.0' });
        env.Zotero.HTTP.request = async () => {
            if (response instanceof Error) throw response;
            return { response };
        };
        if (response instanceof Error) await assert.rejects(run('updateActions', env));
        else assert.match(await run('updateActions', env), /manually/);
        assert.equal(env.changes.length, 0);
        assert.equal(env.prefs.get('actionsTags.actions.versionTag'), 'v1.0.0');
    }
});
