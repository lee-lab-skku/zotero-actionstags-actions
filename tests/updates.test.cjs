const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

function run(name, env, triggerType = 8) {
    let source = fs.readFileSync(path.join(__dirname, '..', 'src', name + '.js'), 'utf8');
    if (name === 'updateActions' && env.build) source = embed(source, env.build.version, env.build.repository);
    return new vm.Script(`(async () => {${source}\n})()`).runInNewContext({
        require: key => env[key], triggerType,
    });
}

function embed(source, version, repository) {
    return source.replace('const INSTALLED_VERSION = null;', `const INSTALLED_VERSION = ${JSON.stringify(version)};`)
        .replace("const SOURCE_REPOSITORY = 'lee-lab-skku/zotero-actionstags-actions';",
            `const SOURCE_REPOSITORY = ${JSON.stringify(repository)};`);
}

const repository = 'example-lab/actions';
const preference = 'actionsTags.actions.includePrereleases';
function release(tag, options = {}) {
    return { tag_name: tag, prerelease: false, draft: false, assets: [{
        name: 'actions-zotero.json',
        browser_download_url: `https://github.com/${repository}/releases/download/${tag}/actions-zotero.json`,
    }], ...options };
}

function environment({ current = 'v1.0.0', releases = [release('v2.0.0')], pages,
    prereleases = false, choice = 0, cancel = false, failKey, backup } = {}) {
    const prefs = new Map([[preference, prereleases], ['actionsTags.actions.versionTag', 'v0.9.0']]);
    const updaterSource = fs.readFileSync(path.join(__dirname, '..', 'src/updateActions.js'), 'utf8');
    const installed = new Map([['updateActions', { data: embed(updaterSource, current, repository), enabled: false, shortcut: 'mine' }]]);
    const requests = [], prompts = [], writes = [];
    const Zotero = {
        Prefs: { get: key => prefs.get(key), set: (key, value) => prefs.set(key, value) },
        getMainWindow: () => null,
        ActionsTags: { api: { actionManager: {
            getActions: key => installed.get(key),
            updateAction: async (action, key) => {
                if (key === failKey) throw Error('write failed');
                writes.push(key); installed.set(key, action);
            },
        } } },
        HTTP: { request: async (method, url) => {
            requests.push(url);
            const parsed = new URL(url);
            if (parsed.hostname === 'api.github.com')
                return { response: pages ? pages[Number(parsed.searchParams.get('page')) - 1] || [] : releases };
            const tag = parsed.pathname.split('/').at(-2);
            return { response: backup || { type: 'ActionsTagsBackup', version: tag, repository, actions: {
                updateActions: { event: 8, operation: 4, data: embed(updaterSource, tag, repository) },
                first: { event: 0, operation: 4, data: 'return;' },
            } } };
        } },
    };
    const Services = { prompt: { select: (win, title, message, choices, selected) => {
        assert.equal(selected.value, 0);
        assert.equal(choices[0], 'Not now');
        prompts.push({ message, choices: [...choices] });
        selected.value = choice;
        return !cancel;
    } } };
    return { Zotero, Services, prefs, installed, requests, prompts, writes, build: { version: current, repository } };
}

test('startup and manual dispatch stay quiet for equal/older tags and local Git builds', async () => {
    for (const trigger of [8, 'menu']) {
        const env = environment({ current: 'v3.0.0-beta.3-6-g1bcfedd-dirty', prereleases: true,
            releases: [release('v2.6.0'), release('v3.0.0-beta.3', { prerelease: true })] });
        await run('updateActions', env, trigger);
        assert.equal(env.prompts.length, 0);
        assert.equal(env.writes.length, 0);
    }
});

test('prereleases require opt-in; turning them off does not downgrade a beta', async () => {
    for (const enabled of [false, true]) {
        const env = environment({ current: 'v3.0.0-beta.3-6-g1bcfedd', prereleases: enabled,
            releases: [release('v2.6.0'), release('v3.0.0-beta.4', { prerelease: true })] });
        await run('updateActions', env);
        assert.equal(env.prompts.length, Number(enabled));
        assert.equal(env.writes.length, 0);
    }
});

test('dialog lists all intervening allowed versions and installs the chosen intermediate release', async () => {
    const env = environment({ prereleases: true, choice: 3, releases: [
        release('v1.1.0'), release('v2.0.0-beta.1', { prerelease: true }),
        release('v1.2.0'), release('v1.0.0'), release('v9.0.0', { draft: true }),
    ] });
    await run('updateActions', env, 'menu');
    assert.deepEqual(env.prompts[0].choices, ['Not now', 'v2.0.0-beta.1 (prerelease)',
        'v1.2.0 (stable)', 'v1.1.0 (stable)']);
    assert.match(env.prompts[0].message, /Installed: v1.0.0/);
    assert.ok(env.installed.get('updateActions').data.includes('const INSTALLED_VERSION = "v1.1.0";'));
    assert.equal(env.prefs.get('actionsTags.actions.versionTag'), 'v1.1.0');
    assert.equal(env.installed.get('updateActions').enabled, false);
    assert.equal(env.installed.get('updateActions').shortcut, 'mine');
    assert.deepEqual(env.writes, ['first', 'updateActions']);
});

test('tag comparison uses numeric prerelease components and ignores build metadata', async () => {
    const env = environment({ current: 'v1.0.0-beta.2+local', prereleases: true, releases: [
        release('v1.0.0-beta.10', { prerelease: true }), release('v1.0.0-beta.3', { prerelease: true }),
        release('v1.0.0'), release('v1.0.0-beta.2+other', { prerelease: true }),
        release('v1.0.0-beta.01', { prerelease: true }),
    ] });
    await run('updateActions', env);
    assert.deepEqual(env.prompts[0].choices, ['Not now', 'v1.0.0 (stable)',
        'v1.0.0-beta.10 (prerelease)', 'v1.0.0-beta.3 (prerelease)']);
});

test('release pagination reaches newer releases beyond the first page', async () => {
    const env = environment({ pages: [Array.from({ length: 100 }, () => release('v0.1.0')),
        [release('v1.1.0')]] });
    await run('updateActions', env);
    assert.equal(env.requests.length, 2);
    assert.match(env.requests[1], /page=2$/);
    assert.deepEqual(env.prompts[0].choices, ['Not now', 'v1.1.0 (stable)']);
});

test('cancel and Not now never download or write actions', async () => {
    for (const cancel of [true, false]) {
        const env = environment({ cancel });
        await run('updateActions', env);
        assert.equal(env.requests.length, 1);
        assert.equal(env.writes.length, 0);
        assert.equal(env.prefs.get('actionsTags.actions.versionTag'), 'v0.9.0');
    }
});

test('YAML-only candidates are shown as manual imports without automatic writes', async () => {
    const env = environment({ choice: 1, releases: [release('v1.1.0', { assets: [{ name: 'actions-zotero.yml' }] })] });
    assert.match(await run('updateActions', env), /manually/);
    assert.match(env.prompts[0].choices[1], /manual YAML import/);
    assert.equal(env.requests.length, 1);
    assert.equal(env.writes.length, 0);
});

test('unknown installed versions are not guessed from remote latest releases', async () => {
    const env = environment({ current: 'unknown' });
    assert.match(await run('updateActions', env), /version is unknown/);
    assert.equal(env.requests.length, 0);
    assert.equal(env.prompts.length, 0);
});

test('mismatched backup provenance/version fails before writes', async () => {
    for (const overrides of [{ version: 'v1.0.0' }, { repository: 'different/source' }]) {
        const env = environment({ choice: 1, backup: { type: 'ActionsTagsBackup', version: 'v2.0.0', repository,
            actions: { first: { event: 0, operation: 4, data: 'return;' } }, ...overrides } });
        await assert.rejects(run('updateActions', env), /does not match/);
        assert.equal(env.writes.length, 0);
    }
});

test('partial write failure leaves installed updater code and success record unchanged', async () => {
    const env = environment({ choice: 1, failKey: 'second', backup: { type: 'ActionsTagsBackup', actions: {
        updateActions: { event: 8, operation: 4, data: 'return;' },
        first: { event: 0, operation: 4, data: 'return;' },
        second: { event: 0, operation: 4, data: 'return;' },
    } } });
    await assert.rejects(run('updateActions', env), /write failed/);
    assert.deepEqual(env.writes, ['first']);
    assert.ok(env.installed.get('updateActions').data.includes('const INSTALLED_VERSION = "v1.0.0";'));
    assert.equal(env.prefs.get('actionsTags.actions.versionTag'), 'v0.9.0');
});

test('setPreferences defaults to No, remembers startup choice, and allows manual changes', async () => {
    for (const [previous, trigger, answer, expectedCalls, expected] of [
        [undefined, 8, 0, 1, false], [undefined, 8, 1, 1, true],
        [true, 8, 0, 0, true], [true, 'menu', 0, 1, false],
    ]) {
        const prefs = new Map([[preference, previous]]);
        let calls = 0;
        const env = {
            Zotero: { Prefs: { get: key => prefs.get(key), set: (key, value) => prefs.set(key, value) },
                Groups: { getAll: () => [] } },
            Services: { prompt: {
                BUTTON_POS_0: 1, BUTTON_POS_1: 256, BUTTON_TITLE_NO: 4, BUTTON_TITLE_YES: 3, BUTTON_POS_0_DEFAULT: 0,
                confirmEx: (win, title, message, flags) => { calls++; assert.equal(flags, 772); return answer; },
            } },
        };
        await run('setPreferences', env, trigger);
        assert.equal(calls, expectedCalls);
        assert.equal(prefs.get(preference), expected);
    }
});
