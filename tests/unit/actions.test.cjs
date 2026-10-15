const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { compileAction } = require('../support/action-runner.cjs');
const vm = require('node:vm');

const sourceDir = path.join(__dirname, '../..', 'src');
async function run(name, globals, args = {}) {
    let source = fs.readFileSync(path.join(sourceDir, name + '.js'), 'utf8');
    if (name === 'updateActions' && globals.build)
        source = source.replace('const INSTALLED_VERSION = null;', `const INSTALLED_VERSION = ${JSON.stringify(globals.build.version)};`)
            .replace("const SOURCE_REPOSITORY = 'lee-lab-skku/zotero-actionstags-actions';",
                `const SOURCE_REPOSITORY = ${JSON.stringify(globals.build.repository)};`);
    return compileAction(name, source)(globals, args);
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
        getActions: () => ({ enabled: false, shortcut: 'user' }),
        updateAction: (action, key) => {
            if (fail && key === 'second') throw new Error('write failed');
            changes.push(action);
            return key;
        },
    } } };
    return { ...env, changes, build: { version: previousTag || 'v1.0.0', repository: 'lee-lab-skku/zotero-actionstags-actions' } };
}

test('updater applies initial updates and preserves user enable/shortcut choices', async () => {
    const env = updateEnvironment();
    await run('updateActions', env);
    assert.equal(env.changes.length, 2);
    assert.equal(env.changes[0].enabled, false);
    assert.equal(env.changes[0].shortcut, 'user');
    assert.equal(env.prefs.get('actionsTags.actions.versionTag'), 'v2.0.0');
});

test('updater follows the embedded source repository including other owners', async () => {
    const env = updateEnvironment();
    const repository = 'example-lab/custom-actions';
    env.build.repository = repository;
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
    env.build.repository = '../actions';
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

// Expected URIs follow Zotero's protocol handlers; see tests/API-contracts.md.
test('selection labels fall back from citation key to title to item key across libraries', async () => {
    const env = linkEnvironment();
    const make = (id, key, libraryID, fields) => linkItem({ id, key, libraryID,
        getField: field => fields[field] || '' });
    await run('copySelectionLink', env, { items: [
        make(1, 'USER0001', 7, { citationKey: 'Cite"<&', title: 'Unused' }),
        make(2, 'GROUP001', 8, { title: 'Group "<&' }),
        make(3, 'EMPTY001', 7, {}),
    ] });
    assert.deepEqual(env.copied, [
        ['text/unicode', 'zotero://select/library/items/USER0001\nzotero://select/groups/100/items/GROUP001\nzotero://select/library/items/EMPTY001'],
        ['text/html', '<a href="zotero://select/library/items/USER0001">Cite&quot;&lt;&amp;</a><br><a href="zotero://select/groups/100/items/GROUP001">Group &quot;&lt;&amp;</a><br><a href="zotero://select/library/items/EMPTY001">EMPTY001</a>'],
        ['copy'],
    ]);
});

test('selection without an active pane or main window still copies library-scoped links', async () => {
    for (const absent of ['pane', 'window']) {
        const env = linkEnvironment();
        if (absent === 'pane') env.Zotero.getActiveZoteroPane = () => null;
        else env.Zotero.getMainWindow = () => null;
        await run('copySelectionLink', env, { items: [linkItem()] });
        assert.equal(env.copied[0][1], 'zotero://select/library/items/ITEM');
    }
});

function annotationItem(libraryType = 'user', standalone = false) {
    const top = linkItem({ key: 'TOP00001', getField: field => field === 'title' ? 'PDF title <&' : '' });
    const pdf = { key: 'PDF00001', isPDFAttachment: () => true,
        isRegularItem: () => false, getField: field => field === 'title' ? 'Standalone PDF' : '',
        ...(standalone ? {} : { parentItem: top }) };
    return { key: 'ANN00001', libraryID: libraryType === 'user' ? 7 : 8,
        library: { libraryType }, isAnnotation: () => true, parentItem: pdf,
        annotationPosition: '{"pageIndex":0}',
        annotationText: 'one two three four five six seven eight nine <&' };
}
function topLevel(items) {
    return [...new Set(items.map(item => {
        while (item.parentItem) item = item.parentItem;
        return item;
    }))];
}

test('PDF clipboard links use one-based pages, group IDs and top-level labels', async () => {
    for (const [kind, standalone, scope, label] of [
        ['user', false, 'library', 'PDF title &lt;&amp;'],
        ['group', false, 'groups/100', 'PDF title &lt;&amp;'],
        ['user', true, 'library', 'Standalone PDF'],
    ]) {
        const env = linkEnvironment();
        env.Zotero.Items = { getTopLevel: topLevel };
        await run('copyAnnotationLink', env, { item: annotationItem(kind, standalone) });
        const uri = `zotero://open-pdf/${scope}/items/PDF00001?page=1&annotation=ANN00001`;
        assert.deepEqual(env.copied, [['text/unicode', uri],
            ['text/html', `<a href="${uri}">one two three four five six seven eight... (${label})</a>`], ['copy']]);
    }
});

test('annotation clipboard previews add ellipses only for omitted text', async () => {
    for (const [annotationText, preview] of [
        ['short < & >', 'short &lt; &amp; &gt;'],
        ['one two three four five six seven eight', 'one two three four five six seven eight'],
        ['one two three four five six seven eight nine', 'one two three four five six seven eight...'],
        ['one two three four five six seven eight   ', 'one two three four five six seven eight'],
        ['one  two three four five six seven eight', 'one  two three four five six seven...'],
        ['', ''],
        [undefined, ''],
    ]) {
        const env = linkEnvironment();
        env.Zotero.Items = { getTopLevel: topLevel };
        await run('copyAnnotationLink', env, { item: { ...annotationItem(), annotationText } });
        const label = `${preview ? preview + ' ' : ''}(PDF title &lt;&amp;)`;
        assert.equal(env.copied[1][1], `<a href="zotero://open-pdf/library/items/PDF00001?page=1&annotation=ANN00001">${label}</a>`);
    }
});

test('annotations reject absent/non-PDF parents and non-integer page indices without copying', async () => {
    const env = linkEnvironment();
    assert.equal(await run('copyAnnotationLink', env), undefined);
    for (const parentItem of [undefined, { isPDFAttachment: () => false }])
        assert.match(await run('copyAnnotationLink', env, { item: { ...annotationItem(), parentItem } }), /Select an annotation/);
    for (const pageIndex of [0.5, '1', null])
        assert.match(await run('copyAnnotationLink', env, { item: {
            ...annotationItem(), annotationPosition: JSON.stringify({ pageIndex }) } }), /valid PDF page/);
    assert.equal(env.copied.length, 0);
});

test('annotation empty previews fall back to the top-level item key', async () => {
    const env = linkEnvironment();
    const item = annotationItem();
    item.annotationText = '';
    item.parentItem.parentItem.getField = () => '';
    env.Zotero.Items = { getTopLevel: topLevel };
    await run('copyAnnotationLink', env, { item });
    assert.match(env.copied[1][1], />\(TOP00001\)<\/a>$/);
});

test('note actions reject non-notes and a missing Better Notes API without clipboard writes', async () => {
    const env = linkEnvironment();
    assert.equal(await run('copyNoteLink', env), undefined);
    assert.match(await run('copyNoteLink', env, { item: { isNote: () => false } }), /not a note/);
    assert.match(await run('copyNoteLink', env, { item: { isNote: () => true } }), /not detected/);
    assert.equal(env.copied.length, 0);
});

test('Better Notes supplies the URI unchanged and parent citation keys only decorate labels', async () => {
    const env = linkEnvironment();
    const note = { isNote: () => true, parentItem: linkItem({ getField: () => 'Parent26' }),
        getField: () => 'A "quoted" note <&' };
    const uri = 'zotero://note/8/NOTE0001/?line=4&section=Intro';
    env.Zotero.Items = { getTopLevel: topLevel };
    env.Zotero.BetterNotes = { api: { convert: { note2link: async received => {
        assert.equal(received, note); return uri;
    } } } };
    await run('copyNoteLink', env, { item: note });
    assert.deepEqual(env.copied, [['text/unicode', uri], ['text/html',
        '<a href="zotero://note/8/NOTE0001/?line=4&amp;section=Intro">A &quot;quoted&quot; note &lt;&amp; (Parent26)</a>'], ['copy']]);
});

test('menu copy failures propagate to the A&T error handler', async () => {
    for (const name of ['copySelectionLink', 'copyAnnotationLink', 'copyNoteLink']) {
        const env = linkEnvironment();
        const failure = new Error('clipboard unavailable');
        env.Zotero.ActionsTags.api.utils.ClipboardHelper = class {
            addText() {} copy() { throw failure; }
        };
        env.Zotero.Items = { getTopLevel: topLevel };
        env.Zotero.BetterNotes = { api: { convert: { note2link: () => 'zotero://note/u/NOTE0001/' } } };
        const args = name === 'copySelectionLink' ? { items: [linkItem()] }
            : { item: name === 'copyAnnotationLink' ? annotationItem()
                : { isNote: () => true, isRegularItem: () => false, getField: () => 'Note' } };
        await assert.rejects(run(name, env, args), error => error === failure);
    }
});

function reviewEnvironment({ date = [2026, 11, 31, 23, 59], selected = 0, cancel = false } = {}) {
    const env = prefsEnvironment({ 'actionsTags.actions.groupID': 100,
        'actionsTags.actions.reviewCollectionKey': 'REVIEW', 'actionsTags.actions.reviewerName': ' Reviewer ' });
    env.Zotero.Groups = { get: () => ({ libraryID: 8 }) };
    env.Zotero.Collections = { getByLibraryAndKey: () => ({ id: 10 }) };
    const saved = [], prompts = [];
    env.Zotero.Item = class {
        constructor(type) { assert.equal(type, 'note'); }
        setNote(html) { this.html = html; }
        async saveTx() { saved.push(this); }
    };
    env.Services = { prompt: { select: (win, title, message, choices, result) => {
        prompts.push([...choices]); result.value = selected; return !cancel;
    } } };
    class LocalDate extends Date {
        constructor(...args) { super(...(args.length ? args : date)); }
        toISOString() { assert.fail('Review dates must remain local'); }
    }
    const item = { id: 12, libraryID: 8, isRegularItem: () => true,
        isEditable: () => true, getCollections: () => [10] };
    return { ...env, saved, prompts, item, Date: LocalDate };
}

test('review notes avoid prompts and writes for ineligible items or incomplete setup', async () => {
    const changes = [
        env => { env.item = null; }, env => { env.item.isRegularItem = () => false; },
        env => { env.item.deleted = true; }, env => { env.Zotero.Groups.get = () => false; },
        env => { env.prefs.delete('actionsTags.actions.reviewCollectionKey'); },
        env => { env.Zotero.Collections.getByLibraryAndKey = () => false; },
        env => { env.item.getCollections = () => [11]; }, env => { env.item.isEditable = () => false; },
        env => { env.prefs.set('actionsTags.actions.reviewerName', '   '); },
    ];
    for (const change of changes) {
        const env = reviewEnvironment(); change(env);
        await run('reviewNote', env, { item: env.item, Date: env.Date });
        assert.deepEqual(env.saved, []); assert.deepEqual(env.prompts, []);
    }
});

test('review date cancellation and invalid selection never create a note', async () => {
    for (const options of [{ cancel: true }, { selected: -1 }, { selected: 15 }]) {
        const env = reviewEnvironment(options);
        await run('reviewNote', env, { item: env.item, Date: env.Date });
        assert.equal(env.prompts.length, 1); assert.deepEqual(env.saved, []);
    }
});

test('review date choices cross local year and leap-day boundaries', async () => {
    for (const [date, selected, firstChoices, title] of [
        [[2026, 11, 31, 23, 59], 1, ['12-31', '01-01', '01-02'], '270101 Reviewer'],
        [[2028, 1, 28, 0, 1], 2, ['02-28', '02-29', '03-01'], '280301 Reviewer'],
    ]) {
        const env = reviewEnvironment({ date, selected });
        await run('reviewNote', env, { item: env.item, Date: env.Date });
        assert.deepEqual(env.prompts[0].slice(0, 3), firstChoices);
        assert.equal(env.saved.length, 1); assert.equal(env.saved[0].html, `<h1>${title}</h1>`);
        assert.equal(env.saved[0].libraryID, 8); assert.equal(env.saved[0].parentID, 12);
    }
});

test('review transaction failures propagate instead of reporting success', async () => {
    const env = reviewEnvironment();
    env.Zotero.Item.prototype.saveTx = async () => { throw Error('transaction failed'); };
    await assert.rejects(run('reviewNote', env, { item: env.item, Date: env.Date }), /transaction failed/);
    assert.deepEqual(env.saved, []);
});

function setupEnvironment() {
    const env = prefsEnvironment({ 'actionsTags.actions.includePrereleases': false,
        'actionsTags.actions.groupID': 999, 'actionsTags.actions.reviewCollectionKey': 'STALE' });
    const group = { id: 100, libraryID: 8, name: 'Organization' };
    const collection = { key: 'REVIEW', name: 'Review' };
    env.Zotero.Groups = { get: id => id === 100 ? group : false, getAll: () => [group] };
    env.Zotero.Collections = { getByLibrary: (id, recursive) => {
        assert.equal(id, 8); assert.equal(recursive, true); return [collection];
    }, getByLibraryAndKey: (id, key) => id === 8 && key === 'REVIEW' ? collection : false };
    const prompts = [];
    env.Services = { prompt: {
        select: (win, title, message, choices, result) => { prompts.push(title); result.value = 0; return true; },
        prompt: (win, title, message, result) => { prompts.push(title); result.value = ' Reviewer '; return true; },
    } };
    return { ...env, prompts };
}

test('preference setup replaces stale groups and collections using library-scoped APIs', async () => {
    const env = setupEnvironment();
    await run('setPreferences', env, { triggerType: 8 });
    assert.deepEqual(env.prompts, ['Organization', 'Review', 'Name']);
    assert.equal(env.prefs.get('actionsTags.actions.groupID'), 100);
    assert.equal(env.prefs.get('actionsTags.actions.reviewCollectionKey'), 'REVIEW');
    assert.equal(env.prefs.get('actionsTags.actions.reviewerName'), 'Reviewer');
});

test('preference setup respects group/collection/name cancellation and invalid choices', async () => {
    for (const stop of ['Organization', 'Review', 'Name', 'invalid-group', 'invalid-collection', 'blank-name']) {
        const env = setupEnvironment();
        const select = env.Services.prompt.select;
        env.Services.prompt.select = (...args) => {
            const title = args[1];
            if (title === stop) return false;
            const accepted = select(...args);
            if ((stop === 'invalid-group' && title === 'Organization')
                || (stop === 'invalid-collection' && title === 'Review')) args[4].value = 99;
            return accepted;
        };
        env.Services.prompt.prompt = (win, title, message, result) => {
            if (stop === 'Name') return false;
            result.value = stop === 'blank-name' ? '  ' : 'Reviewer'; return true;
        };
        await run('setPreferences', env, { triggerType: 8 });
        assert.equal(env.prefs.has('actionsTags.actions.reviewerName'), false, stop);
        if (stop === 'Organization' || stop === 'invalid-group')
            assert.equal(env.prefs.get('actionsTags.actions.groupID'), 999);
        if (['Organization', 'invalid-group', 'Review', 'invalid-collection'].includes(stop))
            assert.equal(env.prefs.get('actionsTags.actions.reviewCollectionKey'), 'STALE');
    }
});

test('preference setup with an empty group collection list does not open an empty selector', async () => {
    const env = setupEnvironment();
    env.Zotero.Collections.getByLibrary = () => [];
    assert.match(await run('setPreferences', env, { triggerType: 8 }), /Create and sync/);
    assert.deepEqual(env.prompts, ['Organization']);
});

test('VPN checks skip unsupported configurations and accept HTTP error responses as reachable', async () => {
    for (const [values, expectedRequests, expectedResult] of [
        [{ 'sync.storage.protocol': 'zotero' }, 0, undefined],
        [{ 'sync.storage.protocol': 'webdav' }, 0, undefined],
        [{ 'sync.storage.protocol': 'webdav', 'sync.storage.url': 'dav.example', 'sync.storage.scheme': 'ftp' }, 0, /http or https/],
        [{ 'sync.storage.protocol': 'webdav', 'sync.storage.url': 'dav.example' }, 1, undefined],
    ]) {
        const env = prefsEnvironment(values); let requests = 0;
        env.Services = { prompt: { alert: () => assert.fail('HTTP response proves reachability') } };
        env.Zotero.HTTP = { request: async (method, url, options) => {
            requests++; assert.equal(method, 'HEAD'); assert.equal(url, 'https://dav.example');
            assert.equal(options.successCodes, false); assert.equal(options.errorDelayMax, 0);
            return { status: 503 };
        } };
        const result = await run('checkVPN', env, { triggerType: 8 });
        if (expectedResult instanceof RegExp) assert.match(result, expectedResult);
        else assert.equal(result, expectedResult);
        assert.equal(requests, expectedRequests);
    }
});

test('Delete listeners and running guards belong to each main window', async () => {
    const first = deleteEnvironment(), second = deleteEnvironment();
    second.Zotero = first.Zotero; // Main windows share Zotero but not their listener state.
    await run('trashOnDelete', first, { window: first.window });
    await run('trashOnDelete', second, { window: second.window });
    let finish;
    first.window.ZoteroPane.deleteSelectedItems = async (...args) => {
        first.calls.push(args); await new Promise(resolve => { finish = resolve; });
    };
    first.press(); second.press({ shiftKey: true });
    await flushDelete();
    assert.deepEqual(first.calls, [[true, true]]); assert.deepEqual(second.calls, [[false, true]]);
    first.press(); await flushDelete(); assert.equal(first.calls.length, 1);
    finish(); await flushDelete();
    first.listeners.get('unload')();
    second.press(); await flushDelete();
    assert.equal(second.calls.length, 2);
});
