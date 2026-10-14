const assert = require('node:assert/strict');
const { compileAction } = require('./action-runner.cjs');

async function run(name, env, args = {}) {
    return compileAction(name)(env, { triggerType: 'menu', ...args });
}

function environment() {
    const prefs = new Map();
    const actions = Object.fromEntries(['linkBridge', 'copySelectionLink', 'copyAnnotationLink', 'copyNoteLink']
        .map(key => [key, { enabled: true }]));
    const copied = [];
    const calls = [];
    const errors = [];
    const shutdown = [];
    const library = id => id === 7 ? { libraryType: 'user' }
        : id === 24 ? { libraryType: 'group', groupID: 100 } : false;
    const make = (id, key, kind, libraryID = 7) => ({
        id, key, libraryID, library: library(libraryID), deleted: false,
        isRegularItem: () => kind === 'regular', isAttachment: () => kind === 'pdf',
        isPDFAttachment: () => kind === 'pdf', isAnnotation: () => kind === 'annotation',
        isNote: () => kind === 'note', getCollections: () => [20],
        getField: field => field === 'citationKey' && kind === 'regular' ? 'Smith26' : 'Title < & >',
    });
    const parent = make(1, 'ITEM0001', 'regular');
    const pdf = make(2, 'PDF00001', 'pdf'); pdf.parentItem = parent;
    const annotation = make(3, 'ANN00001', 'annotation'); annotation.parentItem = pdf;
    annotation.annotationPosition = JSON.stringify({ pageIndex: 2 });
    annotation.annotationText = 'a < b & c';
    const note = make(4, 'NOTE0001', 'note'); note.parentItem = parent;
    const groupItem = make(5, 'ITEM0001', 'regular', 24);
    const targets = [parent, pdf, annotation, note, groupItem];
    const collection = { id: 20, key: 'COLL0001', libraryID: 7 };
    class ClipboardHelper {
        addText(text, type) { copied.push([type, text]); }
        copy() { copied.push('copy'); }
    }
    const Zotero = {
        Prefs: { get: key => prefs.get(key), set: (key, value) => prefs.set(key, value) },
        Server: { Endpoints: {} }, Libraries: { userLibraryID: 7, get: library },
        Groups: { get: id => id === 100 ? { libraryID: 24 } : false },
        Items: {
            getByLibraryAndKeyAsync: async (id, key) => targets.find(item => item.libraryID === id && item.key === key),
            getTopLevel: items => [...new Set(items.map(item => {
                while (item.parentItem) item = item.parentItem;
                return item;
            }))],
        },
        Collections: { getByLibraryAndKey: (id, key) => id === 7 && key === collection.key ? collection : false },
        getActiveZoteroPane: () => ({ getSelectedCollections: () => [collection], getCollectionTreeRows: () => [collection] }),
        getMainWindow: () => ({ Zotero_Tabs: { selectedType: 'library' } }),
        BetterNotes: { api: { convert: { note2link: target => 'zotero://note/u/' + target.key + '/' } } },
        addShutdownListener: callback => shutdown.push(callback),
        logError: error => errors.push(error),
        ActionsTags: { api: { utils: { ClipboardHelper }, actionManager: {
            getActions: key => actions[key],
            // Mirrors applyAction: no returned result, exceptions caught by the plugin.
            dispatchActionByKey: async (key, args) => {
                calls.push([key, args]);
                const item = targets.find(target => target.id === args.itemID) || null;
                const items = (args.itemIDs || []).map(id => targets.find(target => target.id === id));
                try {
                    await run(key, env, { item, items, collection: args.collectionID ? collection : false,
                        triggerType: args.triggerType });
                } catch (error) { errors.push(error); }
            },
        } } },
    };
    const env = { Zotero, Services: { uuid: { generateUUID: () => '{00112233-4455-6677-8899-aabbccddeeff}' } },
        actions, targets, collection, copied, calls, errors, prefs, shutdown };
    return env;
}
async function start() {
    const env = environment();
    await run('linkBridge', env);
    env.request = async (data, headers = {}) => {
        const Endpoint = env.Zotero.Server.Endpoints['/action-links'];
        const [status, contentType, text] = await new Endpoint().init({
            data, headers: { 'x-action-link-token': env.prefs.get('actionsTags.actions.linkBridgeToken'), ...headers },
        });
        assert.equal(contentType, 'application/json');
        return { status, ...JSON.parse(text) };
    };
    return env;
}
const selection = { action: 'copySelectionLink', library: { type: 'user' }, itemKeys: ['ITEM0001'] };


module.exports = { run, environment, start, selection };
