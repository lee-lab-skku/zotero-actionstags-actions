const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compileAction } = require('../support/action-runner.cjs');
const { test } = require('node:test');

function run(name, env, triggerType = 8) {
    let source = fs.readFileSync(path.join(__dirname, '../..', 'src', name + '.js'), 'utf8');
    if (name === 'updateActions' && env.build) source = embed(source, env.build.version, env.build.repository);
    return compileAction(name, source)(env, { triggerType });
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
    const updaterSource = fs.readFileSync(path.join(__dirname, '../..', 'src/updateActions.js'), 'utf8');
    const installed = new Map([['updateActions', { data: embed(updaterSource, current, repository), enabled: false, shortcut: 'mine' }]]);
    const requests = [], prompts = [], writes = [];
    const Zotero = {
        Prefs: { get: key => prefs.get(key), set: (key, value) => prefs.set(key, value) },
        getMainWindow: () => null,
        ActionsTags: { api: { actionManager: {
            getActions: key => installed.get(key),
            updateAction: (action, key) => {
                if (key === failKey) throw Error('write failed');
                writes.push(key); installed.set(key, action); return key;
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

// Ordering is the SemVer 2.0.0 example, exercised through the public action.
test('release ordering follows numeric/textual prerelease precedence and stable promotion', async () => {
    const ordered = ['v1.0.0', 'v1.0.0-rc.1', 'v1.0.0-beta.11', 'v1.0.0-beta.2',
        'v1.0.0-beta', 'v1.0.0-alpha.beta', 'v1.0.0-alpha.1', 'v1.0.0-alpha'];
    const env = environment({ current: 'v0.9.0', prereleases: true,
        releases: [...ordered].reverse().map(tag => release(tag, { prerelease: tag.includes('-') })) });
    await run('updateActions', env);
    assert.deepEqual(env.prompts[0].choices.slice(1).map(choice => choice.split(' ')[0]), ordered);
    assert.deepEqual(env.writes, []);
});

test('drafts and invalid SemVer tags are excluded even with prerelease opt-in', async () => {
    const invalid = ['v02.0.0', 'v2.00.0', 'v2.0.01', 'v2.0.0-beta.01', 'v2.0', 'latest'];
    const env = environment({ prereleases: true, releases: [
        release('v9.0.0', { draft: true }), ...invalid.map(tag => release(tag)), release('v2.0.0'),
    ] });
    await run('updateActions', env);
    assert.deepEqual(env.prompts[0].choices, ['Not now', 'v2.0.0 (stable)']);
});

test('every malformed backup is rejected before the first action write', async () => {
    const valid = { event: 0, operation: 4, data: 'return;' };
    const malformed = [null, {}, { type: 'Wrong', actions: { first: valid } },
        { type: 'ActionsTagsBackup', actions: [] }, { type: 'ActionsTagsBackup', actions: {} },
        ...[null, [], { ...valid, event: -1 }, { ...valid, event: true }, { ...valid, event: 0.5 },
            { ...valid, operation: -1 }, { ...valid, operation: true }, { ...valid, operation: 6 },
            { ...valid, operation: 1.5 }, { ...valid, data: 3 }].map(action => ({
                type: 'ActionsTagsBackup', actions: { first: valid, second: action },
            })),
    ];
    for (const backup of malformed) {
        const env = environment({ choice: 1 });
        const http = env.Zotero.HTTP.request;
        env.Zotero.HTTP.request = async (method, url, options) => url.startsWith('https://api.github.com/')
            ? http(method, url, options) : { response: backup };
        await assert.rejects(run('updateActions', env), /valid action backup|Invalid action/);
        assert.deepEqual(env.writes, []);
        assert.equal(env.prefs.get('actionsTags.actions.versionTag'), 'v0.9.0');
    }
});

test('new actions inherit release settings, absent actions remain, and the updater is applied last', async () => {
    const env = environment({ choice: 1, backup: { type: 'ActionsTagsBackup', actions: {
        updateActions: { event: 8, operation: 4, data: 'return;' },
        first: { event: 0, operation: 4, data: 'return;', enabled: true, shortcut: 'release' },
    } } });
    env.installed.set('obsolete', { event: 0, operation: 4, data: 'return;' });
    await run('updateActions', env);
    assert.deepEqual(env.writes, ['first', 'updateActions']);
    assert.equal(env.installed.get('first').data, 'return;');
    assert.equal(env.installed.get('first').enabled, true);
    assert.equal(env.installed.get('first').shortcut, 'release');
    assert.ok(env.installed.has('obsolete'));
    assert.equal(env.installed.get('updateActions').enabled, false);
    assert.equal(env.installed.get('updateActions').shortcut, 'mine');
});

test('identical replacement actions are not rewritten while the selected version is recorded', async () => {
    const action = { event: 0, operation: 4, data: 'return;', enabled: false, shortcut: 'mine' };
    const env = environment({ choice: 1, backup: { type: 'ActionsTagsBackup', actions: { first: action } } });
    env.installed.set('first', { ...action });
    assert.match(await run('updateActions', env), /Updated 0 actions/);
    assert.deepEqual(env.writes, []);
    assert.equal(env.prefs.get('actionsTags.actions.versionTag'), 'v2.0.0');
});

test('release API errors use Zotero HTTP JSON options and do not leave a running guard', async () => {
    const env = environment();
    const original = env.Zotero.HTTP.request;
    env.Zotero.HTTP.request = async (method, url, options) => {
        assert.equal(method, 'GET'); assert.equal(options.responseType, 'json');
        assert.equal(options.timeout, 30000); assert.equal(options.errorDelayMax, 0);
        assert.equal(options.headers.Accept, 'application/vnd.github+json');
        assert.equal(options.successCodes, undefined, 'Non-2xx responses must reject, as Zotero HTTP does');
        throw Error('HTTP 503');
    };
    await assert.rejects(run('updateActions', env), /HTTP 503/);
    assert.deepEqual(env.writes, []);
    env.Zotero.HTTP.request = original;
    await run('updateActions', env);
    assert.equal(env.prompts.length, 1, 'The next check must run');
});

test('malformed release lists and unsafe download URLs never modify installed actions', async () => {
    const env = environment();
    env.Zotero.HTTP.request = async () => ({ response: { message: 'API error' } });
    await assert.rejects(run('updateActions', env), /invalid release list/);
    assert.deepEqual(env.writes, []);
    for (const url of ['https://other.example/actions-zotero.json',
        'https://github.com/other/repo/releases/download/v2.0.0/actions-zotero.json']) {
        const candidate = release('v2.0.0'); candidate.assets[0].browser_download_url = url;
        const next = environment({ choice: 1, releases: [candidate] });
        assert.match(await run('updateActions', next), /manually/);
        assert.equal(next.requests.length, 1); assert.deepEqual(next.writes, []);
    }
});
