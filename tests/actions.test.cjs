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

test('preferences migrate legacy group ID and initialize names with a string', async () => {
    const env = prefsEnvironment({ 'tara.groupID': 100 });
    const group = { id: 100, libraryID: 8 };
    env.Zotero.Groups = { get: id => id === 100 && group };
    env.Zotero.Collections = { getByLibrary: id => {
        assert.equal(id, 8); return [{ key: 'COLL', name: 'Review' }];
    } };
    env.Services = { prompt: {
        select: (win, title, message, choices, selected) => { selected.value = 0; return true; },
        prompt: (win, title, message, input) => { assert.equal(input.value, ''); input.value = ' Reviewer '; return true; },
    } };
    await run('setPreferences', env);
    assert.equal(env.prefs.get('actionsTags.actions.groupID'), 100);
    assert.equal(env.prefs.get('actionsTags.actions.reviewerName'), 'Reviewer');
});

test('preferences handle no joined groups without opening an empty selector', async () => {
    const env = prefsEnvironment();
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
    const changes = [];
    const action = { event: 0, operation: 4, data: 'return;', enabled: true, shortcut: 'new' };
    const backup = { type: 'ActionsTagsBackup', actions: { first: action, second: invalid ? {} : action } };
    env.Zotero.HTTP = { request: async (method, url) => ({ response: url.includes('api.github.com')
        ? { tag_name: 'v2', assets: [{ name: 'actions-zotero.json', browser_download_url: 'https://github.com/lee-lab-skku/zotero-actionstags-actions/releases/download/v2/actions-zotero.json' }] }
        : backup }) };
    env.Zotero.ActionsTags = { api: { actionManager: {
        getActions: () => ({ enabled: false, shortcut: 'user' }),
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
    assert.equal(env.prefs.get('actionsTags.actions.versionTag'), 'v2');
});

test('updater validates the entire backup and does not advance version on failed writes', async () => {
    for (const options of [{ invalid: true }, { fail: true }]) {
        const env = updateEnvironment({ ...options, previousTag: 'v1' });
        await assert.rejects(run('updateActions', env));
        assert.equal(env.prefs.get('actionsTags.actions.versionTag'), 'v1');
        if (options.invalid) assert.equal(env.changes.length, 0);
    }
});

function copyEnvironment({ missing = false, failCopy = false, sourceLibrary = 8 } = {}) {
    const env = prefsEnvironment({ 'actionsTags.actions.groupID': 100, 'actionsTags.actions.shareCollectionKey': 'SHARE' });
    const events = [];
    const destination = { id: 20, key: 'DEST', name: 'Destination', libraryID: sourceLibrary === 8 ? 7 : 8 };
    const source = { id: 1, libraryID: sourceLibrary, deleted: false,
        isRegularItem: () => true, isEditable: () => true, getCollections: () => [10],
        getAttachments: () => [2], getNotes: () => [3], clone: libraryID => {
            events.push('clone'); return { id: 4, libraryID, setCollections: ids => assert.equal(ids[0], 20),
                save: async () => events.push('save-parent') };
        }, saveTx: async options => { assert.equal(options.undoAction, 'undo-action-trash'); events.push('trash'); },
    };
    const attachment = { isFileAttachment: () => true, isLinkedFileAttachment: () => false, fileExists: async () => !missing };
    const note = { getAttachments: () => [], clone: () => ({ save: async () => events.push('save-note') }) };
    env.Zotero.Groups = { get: () => ({ libraryID: 8 }) };
    env.Zotero.Libraries = { userLibraryID: 7, get: () => ({ editable: true, filesEditable: true }) };
    env.Zotero.Collections = { getByLibraryAndKey: () => sourceLibrary === 8
        ? { id: 10 } : destination, getByLibrary: libraryID => { assert.equal(libraryID, 7); return [destination]; } };
    env.Zotero.Items = { getAsync: async ids => ids.map(id => ({ 2: attachment, 3: note })[id]),
        copyChildItems: async () => events.push('annotations') };
    env.Zotero.DB = { executeTransaction: async fn => {
        const result = await fn(); events.push('commit'); return result;
    } };
    env.Zotero.Notes = { copyEmbeddedImages: async () => events.push('images') };
    env.Zotero.Attachments = { copyAttachmentToLibrary: async () => {
        if (failCopy) throw new Error('copy failed'); events.push('attachment'); return {};
    } };
    env.Zotero.ActionsTags = { api: { actionManager: { dispatchActionByKey: async (key, args) => {
        assert.equal(key, 'copySelectionLink'); assert.equal(args.itemID, undefined);
        assert.equal(args.itemIDs[0], 4); events.push('clipboard');
    } } } };
    env.Services = { prompt: { select: (win, title, message, choices, selected) => { selected.value = 0; return true; } } };
    return { ...env, events, source };
}

test('retrieve copies notes, images, files, and annotations before trashing source', async () => {
    const env = copyEnvironment();
    await run('retrieveItem', env, { item: env.source });
    assert.deepEqual(env.events, ['clone', 'save-parent', 'save-note', 'images', 'attachment', 'annotations', 'commit', 'trash']);
    assert.equal(env.source.deleted, true);
});

test('share dispatches the copied selection and keeps the source', async () => {
    const env = copyEnvironment({ sourceLibrary: 7 });
    await run('shareItem', env, { item: env.source });
    assert.equal(env.events.at(-1), 'clipboard');
    assert.equal(env.source.deleted, false);
});

test('failed or incomplete copies never trash source, and missing files prevent writes', async () => {
    for (const name of ['shareItem', 'retrieveItem']) {
        for (const failure of [{ missing: true }, { failCopy: true }]) {
            const env = copyEnvironment({ ...failure, sourceLibrary: name === 'shareItem' ? 7 : 8 });
            await assert.rejects(run(name, env, { item: env.source }));
            assert.equal(env.source.deleted, false);
            assert.ok(!env.events.includes('trash'));
            if (failure.missing) assert.equal(env.events.length, 0);
        }
    }
});

test('retrieve safely ignores the selection-level invocation', async () => {
    const env = copyEnvironment();
    await run('retrieveItem', env);
    assert.equal(env.events.length, 0);
});

test('copies convert linked files and preserve their tags, note, and annotations', async () => {
    const env = copyEnvironment({ sourceLibrary: 7 });
    const attachment = {
        isFileAttachment: () => true, fileExists: async () => true,
        isLinkedFileAttachment: () => true, getFilePathAsync: async () => '/paper.pdf',
        getField: () => 'Paper', attachmentContentType: 'application/pdf',
        getTags: () => [{ tag: 'keep' }], getNote: () => '<p>attachment note</p>',
    };
    const originalGet = env.Zotero.Items.getAsync;
    env.Zotero.Items.getAsync = async ids => ids[0] === 2 ? [attachment] : originalGet(ids);
    env.Zotero.Attachments.importFromFile = async options => {
        assert.equal(options.file, '/paper.pdf');
        assert.equal(options.parentItemID, 4);
        assert.equal(options.libraryID, 8);
        return {
            setTags: tags => assert.equal(tags[0].tag, 'keep'),
            setNote: note => assert.equal(note, '<p>attachment note</p>'),
            save: async () => env.events.push('stored-file'),
        };
    };
    await run('shareItem', env, { item: env.source });
    assert.ok(env.events.includes('stored-file'));
    assert.ok(env.events.includes('annotations'));
});

test('copy preflight rejects read-only targets and disallowed file uploads', async () => {
    for (const permissions of [{ editable: false }, { editable: true, filesEditable: false }]) {
        const env = copyEnvironment();
        env.Zotero.Libraries.get = () => permissions;
        await assert.rejects(run('retrieveItem', env, { item: env.source }));
        assert.equal(env.events.length, 0);
        assert.equal(env.source.deleted, false);
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
    for (const response of [new Error('HTTP 403'), { tag_name: 'v2', assets: [] }]) {
        const env = updateEnvironment({ previousTag: 'v1' });
        env.Zotero.HTTP.request = async () => {
            if (response instanceof Error) throw response;
            return { response };
        };
        if (response instanceof Error) await assert.rejects(run('updateActions', env));
        else assert.match(await run('updateActions', env), /manually/);
        assert.equal(env.changes.length, 0);
        assert.equal(env.prefs.get('actionsTags.actions.versionTag'), 'v1');
    }
});
