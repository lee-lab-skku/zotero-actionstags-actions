const assert = require('node:assert/strict');
const { test } = require('node:test');
const { run, start } = require('../support/link-bridge.cjs');

const annotationRequest = {
    action: 'copyAnnotationLink', library: { type: 'user' }, itemKeys: ['ANN00001'],
};
const sentence = ' \tThe  quick\nbrown fox\tjumps over the lazy dog. \n';

function requestRange(range) {
    return { ...annotationRequest, wordRanges: { ANN00001: range } };
}

function expectedLink(itemKey, preview, start, end, totalWords) {
    const uri = `zotero://open-pdf/library/items/PDF00001?page=3&annotation=${itemKey}`;
    const label = preview ? `${preview} (Smith26)` : 'p. 3 (Smith26)';
    const escaped = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return { uri, label, html: `<a href="${uri}">${escaped}</a>`,
        itemKey, wordRange: { start, end, totalWords } };
}

test('default annotation previews count words across whitespace and preserve internal formatting', async () => {
    const env = await start();
    for (const [text, preview, end, total] of [
        [sentence, 'The  quick\nbrown fox\tjumps over the lazy...', 8, 9],
        [' one  two\tthree\nfour five six seven eight \n', 'one  two\tthree\nfour five six seven eight', 8, 8],
        ["don't state-of-the-art result, however, differs.", "don't state-of-the-art result, however, differs.", 5, 5],
        [' \t\n ', '', 0, 0], ['', '', 0, 0], [undefined, '', 0, 0],
    ]) {
        env.targets[2].annotationText = text;
        const result = await env.request(annotationRequest);
        assert.equal(result.status, 200);
        assert.deepEqual(result.links, [expectedLink('ANN00001', preview, 0, end, total)]);
    }
    assert.deepEqual(env.copied, []);
});

test('explicit annotation word ranges select first, middle, last and entire passages without the default limit', async () => {
    const env = await start();
    env.targets[2].annotationText = sentence;
    for (const [range, preview, start, end] of [
        [{ start: 0, end: 2 }, 'The  quick...', 0, 2],
        [{ start: 2, end: 5 }, '... brown fox\tjumps...', 2, 5],
        [{ start: 5 }, '... over the lazy dog.', 5, 9],
        [{ start: 8, end: 9 }, '... dog.', 8, 9],
        [{ start: 0 }, 'The  quick\nbrown fox\tjumps over the lazy dog.', 0, 9],
        [{ start: 0, end: 9 }, 'The  quick\nbrown fox\tjumps over the lazy dog.', 0, 9],
    ]) {
        const result = await env.request(requestRange(range));
        assert.equal(result.status, 200);
        assert.deepEqual(result.links, [expectedLink('ANN00001', preview, start, end, 9)]);
    }
    env.targets[2].annotationText = 'one <two &three> "four"';
    const result = await env.request(requestRange({ start: 1, end: 3 }));
    assert.deepEqual(result.links, [expectedLink('ANN00001', '... <two &three>...', 1, 3, 4)]);
    assert.deepEqual(env.copied, []);
});

test('per-annotation ranges coexist with defaults and deduplicated batch ordering', async () => {
    const env = await start();
    env.targets[2].annotationText = sentence;
    env.targets.push({ ...env.targets[2], id: 6, key: 'ANN00002', annotationText: 'first second third fourth' });
    env.targets.push({ ...env.targets[2], id: 7, key: 'ANN00003', annotationText: '1 2 3 4 5 6 7 8 9' });
    const result = await env.request({ ...annotationRequest,
        itemKeys: ['ANN00002', 'ANN00001', 'ANN00002', 'ANN00003'],
        wordRanges: { ANN00001: { start: 2, end: 5 }, ANN00002: { start: 1, end: 3 } },
    });
    assert.equal(result.status, 200);
    assert.deepEqual(result.links, [
        expectedLink('ANN00002', '... second third...', 1, 3, 4),
        expectedLink('ANN00001', '... brown fox\tjumps...', 2, 5, 9),
        expectedLink('ANN00003', '1 2 3 4 5 6 7 8...', 0, 8, 9),
    ]);
    assert.deepEqual(env.calls.map(([, args]) => args.itemID), [6, 3, 7]);
    assert.ok(env.calls.every(([, args]) => Object.keys(args).sort().join(',') === 'itemID,triggerType'));
    assert.deepEqual(env.copied, []);
});

test('word range shape and numeric validation happens before dispatch', async () => {
    const env = await start();
    const invalidMaps = [null, [], 'range', 1, { OTHER001: { start: 0 } },
        { bad: { start: 0 } }];
    const invalidRanges = [null, [], 'range', {}, { end: 2 }, { start: null }, { start: true },
        { start: '0' }, { start: -1 }, { start: 0.5 }, { start: Number.MAX_SAFE_INTEGER + 1 },
        { start: 0, end: null }, { start: 0, end: '2' }, { start: 0, end: true },
        { start: 0, end: 0 }, { start: 2, end: 1 }, { start: 0, end: 2.5 },
        { start: 0, end: Number.MAX_SAFE_INTEGER + 1 }];
    for (const data of [
        ...invalidMaps.map(wordRanges => ({ ...annotationRequest, wordRanges })),
        ...invalidRanges.map(requestRange),
        { ...annotationRequest, action: 'copySelectionLink', wordRanges: {} },
        { ...annotationRequest, action: 'copyNoteLink', wordRanges: {} },
    ]) {
        const result = await env.request(data);
        assert.equal(result.status, 400, JSON.stringify(data));
        assert.equal(result.error.code, 'INVALID_WORD_RANGE');
    }
    assert.equal(env.calls.length, 0);
    assert.equal((await env.request({ ...annotationRequest, wordRanges: {} })).status, 200);
});

test('out-of-bounds ranges fail the entire batch and release the request context', async () => {
    const env = await start();
    env.targets[2].annotationText = 'one two three';
    for (const range of [{ start: 3 }, { start: 4, end: 5 }, { start: 0, end: 4 }]) {
        const result = await env.request(requestRange(range));
        assert.equal(result.status, 422);
        assert.equal(result.error.code, 'WORD_RANGE_OUT_OF_BOUNDS');
        assert.equal(result.links, undefined);
        assert.equal(env.Zotero.ActionLinkBridge.active, null);
    }
    for (const annotationText of ['', ' \t\n ']) {
        env.targets[2].annotationText = annotationText;
        assert.equal((await env.request(requestRange({ start: 0 }))).error.code, 'WORD_RANGE_OUT_OF_BOUNDS');
    }
    env.targets[2].annotationText = 'one two three';
    env.targets.push({ ...env.targets[2], id: 6, key: 'ANN00002', annotationText: 'one' });
    const result = await env.request({ ...annotationRequest, itemKeys: ['ANN00001', 'ANN00002'],
        wordRanges: { ANN00001: { start: 1 }, ANN00002: { start: 0, end: 2 } } });
    assert.equal(result.status, 422);
    assert.equal(result.links, undefined);
    assert.equal((await env.request(annotationRequest)).status, 200);
    assert.deepEqual(env.copied, []);
});

test('legacy annotation actions work without ranges but cannot silently satisfy explicit ranges', async () => {
    const env = await start();
    env.Zotero.ActionsTags.api.actionManager.dispatchActionByKey = async key => {
        env.Zotero.ActionLinkBridge.capture(key, env.targets[2], [], null, 'unknown')
            .complete([{ uri: 'legacy', label: 'legacy', html: 'legacy' }]);
    };
    const result = await env.request(requestRange({ start: 1, end: 2 }));
    assert.equal(result.status, 500);
    assert.equal(result.error.code, 'UNSUPPORTED_WORD_RANGE');
    assert.equal((await env.request(annotationRequest)).status, 200);
});

test('bridge rejects malformed, mismatched or incorrectly associated applied ranges', async () => {
    const env = await start();
    env.targets[2].annotationText = 'one two three';
    const bridge = env.Zotero.ActionLinkBridge;
    const capture = bridge.capture;
    let change;
    bridge.capture = function (...args) {
        const sink = capture.apply(this, args);
        return sink && { ...sink, complete: links => { change(links[0]); sink.complete(links); } };
    };
    for (const alter of [
        link => { link.itemKey = 'ANN00002'; },
        link => { link.wordRange.start = 0; },
        link => { link.wordRange.end = 3; },
        link => { link.wordRange.totalWords = 1; },
        link => { link.wordRange.totalWords = '3'; },
        link => { link.wordRange = null; },
        link => { link.wordRange = { start: 1.5, end: 2, totalWords: 3 }; },
        link => { link.wordRange = { start: 1, end: 1, totalWords: 3 }; },
    ]) {
        change = alter;
        const result = await env.request(requestRange({ start: 1, end: 2 }));
        assert.equal(result.status, 500);
        assert.equal(result.error.code, 'INVALID_RESULT');
    }
    bridge.capture = capture;
    assert.equal((await env.request(requestRange({ start: 1, end: 2 }))).status, 200);
});

test('explicit annotation ranges stay isolated from menu calls and subsequent requests', async () => {
    const env = await start();
    env.targets[2].annotationText = sentence;
    const manager = env.Zotero.ActionsTags.api.actionManager;
    const dispatch = manager.dispatchActionByKey;
    let release, entered;
    const waiting = new Promise(resolve => { entered = resolve; });
    manager.dispatchActionByKey = async (...args) => {
        entered(); await new Promise(resolve => { release = resolve; }); await dispatch(...args);
    };
    const pending = env.request(requestRange({ start: 2, end: 5 }));
    await waiting;
    await run('copyAnnotationLink', env, { item: env.targets[2], triggerType: 'menu' });
    assert.equal(env.copied[1][1], expectedLink('ANN00001', 'The  quick\nbrown fox\tjumps over the lazy...', 0, 8, 9).html);
    assert.equal((await env.request(annotationRequest)).status, 409);
    release();
    assert.deepEqual((await pending).links, [expectedLink('ANN00001', '... brown fox\tjumps...', 2, 5, 9)]);
    manager.dispatchActionByKey = dispatch;
    assert.deepEqual((await env.request(annotationRequest)).links,
        [expectedLink('ANN00001', 'The  quick\nbrown fox\tjumps over the lazy...', 0, 8, 9)]);
});
