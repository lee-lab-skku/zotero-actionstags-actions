const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const { start, selection } = require('../../support/link-bridge.cjs');

test('HTTP client receives the endpoint JSON contract through a real socket with a return-dropping dispatcher', async t => {
    const env = await start();
    const Endpoint = env.Zotero.Server.Endpoints['/action-links'];
    const server = http.createServer(async (req, res) => {
        let body = '';
        for await (const chunk of req) body += chunk;
        const [status, type, text] = await new Endpoint().init({ headers: req.headers, data: JSON.parse(body) });
        res.writeHead(status, { 'content-type': type }); res.end(text);
    });
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    t.after(() => new Promise(resolve => server.close(resolve)));
    const request = data => fetch(`http://127.0.0.1:${server.address().port}/action-links`, {
        method: 'POST', headers: { 'content-type': 'application/json',
            'x-action-link-token': env.prefs.get('actionsTags.actions.linkBridgeToken') },
        body: JSON.stringify(data),
    });
    const reply = await request(selection);
    assert.equal(reply.status, 200);
    const result = await reply.json();
    assert.equal(result.links[0].uri, 'zotero://select/library/items/ITEM0001');
    env.targets[2].annotationText = 'one two\n<three> four &five six seven eight nine';
    const annotation = { ...selection, action: 'copyAnnotationLink', itemKeys: ['ANN00001'],
        wordRanges: { ANN00001: { start: 2, end: 5 } } };
    const ranged = await request(annotation);
    assert.equal(ranged.status, 200);
    const link = (await ranged.json()).links[0];
    assert.equal(link.itemKey, 'ANN00001');
    assert.deepEqual(link.wordRange, { start: 2, end: 5, totalWords: 9 });
    assert.equal(link.label, '... <three> four &five... (Smith26)');
    assert.equal(link.html, `<a href="${link.uri}">... &lt;three&gt; four &amp;five... (Smith26)</a>`);
    const invalid = await request({ ...annotation, wordRanges: { ANN00001: { start: 2, end: 10 } } });
    assert.equal(invalid.status, 422);
    assert.equal((await invalid.json()).error.code, 'WORD_RANGE_OUT_OF_BOUNDS');
    assert.equal((await request(selection)).status, 200);
    assert.deepEqual(env.copied, []);
});
