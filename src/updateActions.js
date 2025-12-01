const SOURCE_URL = 'https://cdn.skypack.dev/-/js-yaml@v4.1.1-8B0j8wiUmEXyI4j5ClPv/dist=es2019,mode=imports/optimized/js-yaml.js';
const TARGET_URL = 'https://api.github.com/repos/lee-lab-skku/zotero-actionstags-actions/releases/latest';
const PREF_KEY = 'actionsTags.actions.versionTag';

const latest = await fetch(TARGET_URL).then(res => res.json());
const latestVersion = latest.tag_name;
const prevVersion = Zotero.Prefs.get(PREF_KEY);

if (!prevVersion)
    return 'Automatic update is now set.';
if (prevVersion === latestVersion)
    return;

Zotero.Prefs.set(PREF_KEY, latestVersion);

const assetUrl = latest.assets.find(asset => asset.name.endsWith('.yml')).browser_download_url;
let actions = await fetch(assetUrl).then(res => res.text());

let code = await fetch(SOURCE_URL).then(res => res.text());
code = code.replace(/export\s+default\s+[^;]+;|export\s*\{[^}]*\};?/g, "");

const sb = Cu.Sandbox(Services.scriptSecurityManager.getSystemPrincipal());
Cu.evalInSandbox(code, sb);

actions = sb.load(actions).actions;

let updateCnt = 0;
let exCnt = 0;
let remainCnt = 0;
let actionData;

for (let key in actions) {
    actionData = Zotero.ActionsTags.api.actionManager.getActions(key);
    if (actionData && JSON.stringify(actionData) === JSON.stringify(actions[key]))
        remainCnt++;
    else {
        if (!!actionData)
            exCnt++;
        Zotero.ActionsTags.api.actionManager.updateAction(actions[key], key);
        updateCnt++;
    }
}

return `Updated ${updateCnt} actions (${updateCnt - exCnt} new, ${exCnt} existing) from ${prevVersion} to ${latestVersion}, while ${remainCnt} actions unchanged.`;