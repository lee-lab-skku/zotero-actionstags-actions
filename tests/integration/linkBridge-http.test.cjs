const assert = require('node:assert/strict');
const { test } = require('node:test');
const http = require('node:http');
const { start, selection } = require('../helpers/link-bridge.cjs');

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
    const reply = await fetch(`http://127.0.0.1:${server.address().port}/action-links`, {
        method: 'POST', headers: { 'content-type': 'application/json',
            'x-action-link-token': env.prefs.get('actionsTags.actions.linkBridgeToken') },
        body: JSON.stringify(selection),
    });
    assert.equal(reply.status, 200);
    const result = await reply.json();
    assert.equal(result.links[0].uri, 'zotero://select/library/items/ITEM0001');
    assert.deepEqual(env.copied, []);
});
