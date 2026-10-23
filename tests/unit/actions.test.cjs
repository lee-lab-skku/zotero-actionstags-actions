const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { compileAction } = require('../support/action-runner.cjs');
const vm = require('node:vm');

const sourceDir = path.join(__dirname, '../..', 'src');
async function run(name, globals, args = {}) {
    return compileAction(name)(globals, args);
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
        ['one  two three four five six seven eight', 'one  two three four five six seven eight'],
        [' one\t two\nthree four five six seven eight nine ', 'one\t two\nthree four five six seven eight...'],
        [' \t\n ', ''],
        ['', ''],
        [undefined, ''],
    ]) {
        const env = linkEnvironment();
        env.Zotero.Items = { getTopLevel: topLevel };
        await run('copyAnnotationLink', env, { item: { ...annotationItem(), annotationText } });
        const label = `${preview || 'p. 1'} (PDF title &lt;&amp;)`;
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
    assert.match(env.copied[1][1], />p\. 1 \(TOP00001\)<\/a>$/);
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
