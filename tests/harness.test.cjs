const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

function fixture(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'actions-runner-contract-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    for (const name of ['src', 'meta', 'tests/helpers']) fs.mkdirSync(path.join(root, name), { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'helpers/action-runner.cjs'), path.join(root, 'tests/helpers/action-runner.cjs'));
    const env = { ...process.env };
    // Nested coverage is independent of the repository's action report.
    delete env.NODE_V8_COVERAGE;
    delete env.NODE_TEST_CONTEXT;
    return { root, env };
}

test('the action harness preserves startup, window-load and item/selection argument contracts', t => {
    const { root, env } = fixture(t);
    for (const [name, event, body] of [
        ['startup', 8, "return [typeof item, typeof items, require('Zotero').value, triggerType];"],
        ['window', 9, "return [window.id, typeof item, typeof items];"],
        ['normal', 0, 'return [item, items, collection];'],
    ]) {
        fs.writeFileSync(path.join(root, 'src', name + '.js'), body);
        fs.writeFileSync(path.join(root, 'meta', name + '.yml'), 'event: ' + event);
    }
    const script = `
const assert = require('node:assert/strict');
const { compileAction } = require('./tests/helpers/action-runner.cjs');
(async () => {
    assert.deepEqual(await compileAction('startup')({ Zotero: { value: 5 } }, { triggerType: 8 }), ['undefined', 'undefined', 5, 8]);
    assert.deepEqual(await compileAction('window')({}, { window: { id: 7 } }), [7, 'undefined', 'undefined']);
    assert.deepEqual(await compileAction('normal')({}), [null, [], false]);
    assert.deepEqual(await compileAction('normal')({}, { item: 1, items: [1], collection: 3 }), [1, [1], 3]);
})().catch(error => { console.error(error); process.exitCode = 1; });`;
    const result = spawnSync(process.execPath, ['-e', script], { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
});

test('coverage maps an unexecuted branch to the original action instead of its async wrapper', t => {
    const { root, env } = fixture(t);
    fs.writeFileSync(path.join(root, 'src/probe.js'), "const value = 1;\nif (value === 1) {\n    return 'yes';\n} else {\n    return 'no';\n}\n");
    fs.writeFileSync(path.join(root, 'meta/probe.yml'), 'event: 0');
    fs.writeFileSync(path.join(root, 'probe.test.cjs'), `
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { compileAction } = require('./tests/helpers/action-runner.cjs');
test('probe', async () => { assert.equal(await compileAction('probe')({}), 'yes'); });`);
    const result = spawnSync(process.execPath, ['--enable-source-maps', '--test', '--experimental-test-coverage',
        '--test-coverage-include=**/src/*.js', '--test-reporter=lcov', 'probe.test.cjs'],
    { cwd: root, env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /SF:.*src[/\\]probe\.js/);
    assert.match(result.stdout, /DA:3,[1-9]/, 'Executed return must be covered');
    assert.match(result.stdout, /DA:5,0/, 'Unexecuted return must remain uncovered');
    assert.doesNotMatch(result.stdout, /SF:.*action-sources/);
});
