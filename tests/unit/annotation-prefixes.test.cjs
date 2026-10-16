const assert = require('node:assert/strict');
const { test } = require('node:test');
const { run, start } = require('../support/link-bridge.cjs');

const request = { action: 'copyAnnotationLink', library: { type: 'user' }, itemKeys: ['ANN00001'] };

test('empty annotation previews use page labels, with physical page fallback, in menus and bridge', async () => {
    const env = await start();
    const item = env.targets[2];
    item.annotationType = 'image';
    item.annotationText = '';
    item.annotationComment = 'Do not use this comment';
    for (const [pageLabel, label] of [['iv', 'p. iv (Smith26)'], ['', 'p. 3 (Smith26)'],
        ['  ', 'p. 3 (Smith26)'], [undefined, 'p. 3 (Smith26)'], ['5<&', 'p. 5<& (Smith26)']]) {
        item.annotationPageLabel = pageLabel;
        const result = await env.request(request);
        assert.equal(result.status, 200);
        assert.equal(result.links[0].label, label);
        assert.deepEqual(result.links[0].wordRange, { start: 0, end: 0, totalWords: 0 });
        assert.match(result.links[0].uri, /page=3&annotation=ANN00001$/);
        env.copied.length = 0;
        await run('copyAnnotationLink', env, { item });
        assert.equal(env.copied[1][1], result.links[0].html);
    }
    assert.match(env.copied[1][1], /p\. 5&lt;&amp; \(Smith26\)/);
});

test('prefixes add an automatic separator, escape HTML, preserve ranges and isolate batch targets', async () => {
    const env = await start();
    env.targets[2].annotationText = '';
    env.targets.push({ ...env.targets[2], id: 6, key: 'ANN00002', annotationText: 'one two three' });
    const result = await env.request({ ...request, itemKeys: ['ANN00002', 'ANN00001', 'ANN00002'],
        prefixes: { ANN00001: ' 그림 <3> & "결과" ', ANN00002: '설명' },
        wordRanges: { ANN00002: { start: 1, end: 2 } } });
    assert.equal(result.status, 200);
    assert.deepEqual(result.links.map(link => [link.itemKey, link.label, link.prefix]), [
        ['ANN00002', '설명 — ... two... (Smith26)', '설명'],
        ['ANN00001', '그림 <3> & "결과" — p. 3 (Smith26)', '그림 <3> & "결과"'],
    ]);
    assert.match(result.links[1].html, />그림 &lt;3&gt; &amp; &quot;결과&quot; — p\. 3 \(Smith26\)<\/a>$/);
    assert.deepEqual(result.links[0].wordRange, { start: 1, end: 2, totalWords: 3 });
    assert.deepEqual(result.links[1].wordRange, { start: 0, end: 0, totalWords: 0 });
    assert.deepEqual(env.copied, []);
    const plain = await env.request({ ...request, itemKeys: ['ANN00001', 'ANN00002'], prefixes: { ANN00002: '' } });
    assert.equal(plain.links[0].label, 'p. 3 (Smith26)');
    assert.equal(plain.links[0].prefix, undefined);
    assert.equal(plain.links[1].label, 'one two three (Smith26)');
    assert.equal(plain.links[1].prefix, '');
    const blank = await env.request({ ...request, prefixes: { ANN00001: ' \t\n ' } });
    assert.equal(blank.links[0].label, 'p. 3 (Smith26)');
    assert.equal(blank.links[0].prefix, '');
    await run('copyAnnotationLink', env, { item: env.targets[2] });
    assert.equal(env.copied[1][1], plain.links[0].html);
});

test('invalid prefixes fail before dispatch', async () => {
    const env = await start();
    for (const prefixes of [null, [], 'text', 1, { OTHER001: 'text' }, { ANN00001: null },
        { ANN00001: 1 }, { ANN00001: {} }, { ANN00001: true }]) {
        const result = await env.request({ ...request, prefixes });
        assert.equal(result.status, 400);
        assert.equal(result.error.code, 'INVALID_PREFIX');
    }
    for (const action of ['copySelectionLink', 'copyNoteLink']) {
        const result = await env.request({ ...request, action, prefixes: {} });
        assert.equal(result.error.code, 'INVALID_PREFIX');
    }
    assert.equal(env.calls.length, 0);
    assert.equal((await env.request({ ...request, prefixes: {} })).status, 200);
});

test('explicit prefixes cannot silently succeed with old or inconsistent actions', async () => {
    const env = await start();
    const bridge = env.Zotero.ActionLinkBridge;
    const capture = bridge.capture.bind(bridge);
    for (const [mutate, code] of [
        [link => { delete link.prefix; }, 'UNSUPPORTED_PREFIX'],
        [link => { link.prefix = 'different'; }, 'INVALID_RESULT'],
    ]) {
        bridge.capture = (...args) => {
            const sink = capture(...args);
            return sink && { ...sink, complete: links => { mutate(links[0]); sink.complete(links); } };
        };
        const result = await env.request({ ...request, prefixes: { ANN00001: 'Figure' } });
        assert.equal(result.status, 500);
        assert.equal(result.error.code, code);
        assert.equal(result.links, undefined);
    }
    bridge.capture = capture;
    assert.equal((await env.request(request)).status, 200);
});
