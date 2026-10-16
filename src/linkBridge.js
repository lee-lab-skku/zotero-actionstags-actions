const Zotero = require('Zotero');
const Services = require('Services');
const PATH = '/action-links';
const PREF_TOKEN = 'actionsTags.actions.linkBridgeToken';
const ACTIONS = new Set(['copySelectionLink', 'copyAnnotationLink', 'copyNoteLink']);

if (!Zotero.Server?.Endpoints)
    throw new Error('The Zotero local HTTP server is unavailable.');
const previous = Zotero.ActionLinkBridge;
const shutdownListener = previous?.shutdownListener || (() => Zotero.ActionLinkBridge?.dispose());
previous?.dispose();
if (!Zotero.Prefs.get(PREF_TOKEN)) {
    const token = Array.from({ length: 2 }, () => Services.uuid.generateUUID().toString())
        .join('').replace(/[{}-]/g, '');
    Zotero.Prefs.set(PREF_TOKEN, token);
}

class RequestError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
const failure = (code, message) => ({ ok: false, error: { code, message } });
const response = (status, body) => [status, 'application/json', JSON.stringify(body)];
const keyIsValid = key => typeof key === 'string' && /^[A-Z0-9]{8}$/.test(key);
const manager = () => Zotero.ActionsTags?.api?.actionManager;
const enabled = key => manager()?.getActions(key)?.enabled === true;

const bridge = {
    active: null,
    disposed: false,
    shutdownListener,
    // The dispatcher drops return values. Bind a result receiver only to the exact agent call.
    capture(action, target, targets, selectedCollection, trigger) {
        const context = this.active;
        if (this.disposed || trigger !== 'unknown' || !context || context.action !== action)
            return null;
        const ids = target ? [target.id] : (targets || []).map(entry => entry.id);
        if (ids.length !== context.ids.length || ids.some((id, index) => id !== context.ids[index])
            || (selectedCollection?.id || null) !== context.collectionID)
            return null;
        const settle = result => {
            context.result = context.settled
                ? failure('DUPLICATE_RESULT', 'The action reported more than one result.') : result;
            context.settled = true;
        };
        return {
            wordRange: context.wordRange,
            prefix: context.prefix,
            complete: links => settle({ ok: true, links }),
            fail: (code, message) => settle(failure(code, message)),
        };
    },
    dispose() {
        this.disposed = true;
        this.active = null;
        if (Zotero.Server.Endpoints[PATH] === Endpoint)
            delete Zotero.Server.Endpoints[PATH];
        if (Zotero.ActionLinkBridge === this)
            delete Zotero.ActionLinkBridge;
    },
};

async function resolveRequest(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || !ACTIONS.has(data.action))
        throw new RequestError(400, 'INVALID_REQUEST', 'Specify a supported copylink action.');
    if (!Array.isArray(data.itemKeys) || !data.itemKeys.length || !data.itemKeys.every(keyIsValid))
        throw new RequestError(400, 'INVALID_REQUEST', 'itemKeys must contain Zotero item keys.');
    const wordRanges = new Map();
    if (data.wordRanges !== undefined) {
        if (data.action !== 'copyAnnotationLink' || !data.wordRanges
            || typeof data.wordRanges !== 'object' || Array.isArray(data.wordRanges))
            throw new RequestError(400, 'INVALID_WORD_RANGE', 'wordRanges must map requested annotation keys to ranges.');
        for (const [key, range] of Object.entries(data.wordRanges)) {
            if (!data.itemKeys.includes(key) || !range || typeof range !== 'object' || Array.isArray(range)
                || !Number.isSafeInteger(range.start) || range.start < 0
                || (range.end !== undefined && (!Number.isSafeInteger(range.end) || range.end <= range.start)))
                throw new RequestError(400, 'INVALID_WORD_RANGE', 'Each range needs a nonnegative integer start and an optional greater integer end.');
            // Snapshot validated options before item lookup/dispatch can yield to another call.
            wordRanges.set(key, Object.freeze({ start: range.start,
                ...(range.end === undefined ? {} : { end: range.end }) }));
        }
    }
    const prefixes = new Map();
    if (data.prefixes !== undefined) {
        if (data.action !== 'copyAnnotationLink' || !data.prefixes
            || typeof data.prefixes !== 'object' || Array.isArray(data.prefixes))
            throw new RequestError(400, 'INVALID_PREFIX', 'prefixes must map requested annotation keys to strings.');
        for (const [key, prefix] of Object.entries(data.prefixes)) {
            if (!data.itemKeys.includes(key) || typeof prefix !== 'string')
                throw new RequestError(400, 'INVALID_PREFIX', 'Each prefix must be a string for a requested annotation key.');
            prefixes.set(key, prefix.trim());
        }
    }
    let libraryID;
    if (data.library?.type === 'user' && data.library.id === undefined) {
        libraryID = Zotero.Libraries.userLibraryID;
    } else if (data.library?.type === 'group' && Number.isSafeInteger(data.library.id)
        && data.library.id > 0) {
        libraryID = Zotero.Groups.get(data.library.id)?.libraryID;
    }
    if (!libraryID || !Zotero.Libraries.get(libraryID))
        throw new RequestError(400, 'INVALID_LIBRARY', 'Specify an available user or group library.');
    if (!enabled(data.action))
        throw new RequestError(503, 'ACTION_UNAVAILABLE', 'The requested action is missing or disabled.');
    let selectedCollection = null;
    if (data.collectionKey !== undefined) {
        if (data.action !== 'copySelectionLink' || !keyIsValid(data.collectionKey))
            throw new RequestError(400, 'INVALID_COLLECTION', 'collectionKey is only supported for selection links.');
        selectedCollection = Zotero.Collections.getByLibraryAndKey(libraryID, data.collectionKey);
        if (!selectedCollection || selectedCollection.deleted)
            throw new RequestError(404, 'COLLECTION_NOT_FOUND', 'The collection does not exist in this library.');
    }
    const targets = [];
    for (const key of new Set(data.itemKeys)) {
        const target = await Zotero.Items.getByLibraryAndKeyAsync(libraryID, key);
        if (!target || target.deleted)
            throw new RequestError(404, 'ITEM_NOT_FOUND', `Item ${key} does not exist in this library.`);
        targets.push(target);
    }
    return { action: data.action, targets, selectedCollection, wordRanges, prefixes };
}

async function dispatch(action, targets, selectedCollection, wordRange = null, prefix = undefined) {
    if (bridge.disposed || !enabled('linkBridge') || !enabled(action))
        throw new RequestError(503, 'ACTION_UNAVAILABLE', 'The bridge or requested action is disabled.');
    const context = {
        action, ids: targets.map(target => target.id), wordRange, prefix,
        collectionID: selectedCollection?.id || null, settled: false, result: null,
    };
    bridge.active = context;
    try {
        const args = { triggerType: 'unknown' };
        if (selectedCollection)
            args.collectionID = selectedCollection.id;
        if (action === 'copySelectionLink')
            args.itemIDs = context.ids;
        else
            args.itemID = context.ids[0];
        await manager().dispatchActionByKey(action, args);
        if (bridge.disposed)
            throw new RequestError(503, 'BRIDGE_UNAVAILABLE', 'The bridge was replaced or stopped.');
        const result = context.result;
        if (!context.settled)
            throw new RequestError(500, 'MISSING_RESULT', 'The action did not report a bridge result. Update the copylink actions.');
        if (!result.ok)
            throw new RequestError(422, result.error.code, result.error.message);
        if (!Array.isArray(result.links) || !result.links.length || result.links.some(link =>
            !link || ['uri', 'label', 'html'].some(field => typeof link[field] !== 'string')))
            throw new RequestError(500, 'INVALID_RESULT', 'The action returned an invalid link result.');
        if (action === 'copyAnnotationLink') {
            if (result.links.length !== 1)
                throw new RequestError(500, 'INVALID_RESULT', 'The annotation action must return one link per target.');
            const link = result.links[0];
            if (prefix !== undefined) {
                if (link.prefix === undefined)
                    throw new RequestError(500, 'UNSUPPORTED_PREFIX', 'Update the annotation action to report applied prefixes.');
                if (link.prefix !== prefix || link.itemKey !== targets[0].key)
                    throw new RequestError(500, 'INVALID_RESULT', 'The annotation action returned inconsistent prefix metadata.');
            }
            // Older actions can still serve default requests, but cannot confirm a range.
            if (wordRange && (link.wordRange === undefined || link.itemKey === undefined))
                throw new RequestError(500, 'UNSUPPORTED_WORD_RANGE', 'Update the annotation action to report applied word ranges.');
            if (link.wordRange !== undefined || link.itemKey !== undefined) {
                const applied = link.wordRange;
                if (link.itemKey !== targets[0].key || !applied || typeof applied !== 'object'
                    || !Number.isSafeInteger(applied.totalWords) || applied.totalWords < 0
                    || !Number.isSafeInteger(applied.start) || !Number.isSafeInteger(applied.end)
                    || applied.start < 0 || applied.end < applied.start || applied.end > applied.totalWords
                    || (applied.start === applied.end && (applied.totalWords !== 0 || wordRange))
                    || applied.start !== (wordRange?.start ?? 0)
                    || applied.end !== (wordRange ? (wordRange.end ?? applied.totalWords) : Math.min(8, applied.totalWords)))
                    throw new RequestError(500, 'INVALID_RESULT', 'The annotation action returned inconsistent word range metadata.');
            }
        }
        return result.links;
    } finally {
        if (bridge.active === context)
            bridge.active = null;
    }
}

let busy = false;
class Endpoint {
    supportedMethods = ['POST'];
    supportedDataTypes = ['application/json'];
    allowRequestsFromUnsafeWebContent = false;
    async init(request) {
        if ('origin' in (request.headers || {}))
            return response(403, failure('FORBIDDEN', 'Browser requests are not allowed.'));
        if (!request.headers?.['x-action-link-token']
            || request.headers['x-action-link-token'] !== Zotero.Prefs.get(PREF_TOKEN))
            return response(403, failure('UNAUTHORIZED', 'A valid action link token is required.'));
        if (bridge.disposed || !enabled('linkBridge'))
            return response(503, failure('BRIDGE_UNAVAILABLE', 'The link bridge is disabled.'));
        if (busy)
            return response(409, failure('BUSY', 'Another link request is running. Retry after it finishes.'));
        busy = true;
        try {
            const { action, targets, selectedCollection, wordRanges, prefixes } = await resolveRequest(request.data);
            const links = [];
            if (action === 'copySelectionLink') {
                links.push(...await dispatch(action, targets, selectedCollection));
            } else {
                for (const target of targets)
                    links.push(...await dispatch(action, [target], null, wordRanges.get(target.key), prefixes.get(target.key)));
            }
            return response(200, { ok: true, links });
        } catch (error) {
            if (error instanceof RequestError)
                return response(error.status, failure(error.code, error.message));
            Zotero.logError(error);
            return response(500, failure('ACTION_FAILED', 'The link request failed. See the Zotero error log.'));
        } finally {
            bridge.active = null;
            busy = false;
        }
    }
}
Zotero.ActionLinkBridge = bridge;
Zotero.Server.Endpoints[PATH] = Endpoint;
if (!previous?.shutdownListener)
    Zotero.addShutdownListener(shutdownListener);
