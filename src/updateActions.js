const SOURCE_URL = 'https://cdn.skypack.dev/-/js-yaml@v4.1.1-8B0j8wiUmEXyI4j5ClPv/dist=es2019,mode=imports/optimized/js-yaml.js';
const TARGET_URL = 'https://api.github.com/repos/lee-lab-skku/zotero-actionstags-actions/releases/latest';
const TARGET_FILE_NAME = 'zotero-actionstags-backup.yml';
const PREF_KEY = 'extensions.zotero-actionstags.update-last-version';

const latest = await fetch(TARGET_URL).then(res => res.json());
const latestVersion = latest.tag_name;
const prevVersion = Zotero.Prefs.get(PREF_KEY);

if (prevVersion === latestVersion)
    return;
Zotero.Prefs.set(PREF_KEY, latestVersion);

const assetUrl = latest.assets.find(asset => asset.name === TARGET_FILE_NAME).browser_download_url;
let actions = await fetch(assetUrl).then(res => res.text());

let code = await fetch(SOURCE_URL).then(res => res.text());
code = code.replace(/export\s+default\s+[^;]+;|export\s*\{[^}]*\};?/g, "");

const sb = Cu.Sandbox(Services.scriptSecurityManager.getSystemPrincipal());
Cu.evalInSandbox(code, sb);

actions = sb.load(actions).actions;

let cnt = 0;
for (let key in actions) {
    Zotero.ActionsTags.api.actionManager.updateAction(actions[key], key);
    cnt++;
}

return `Updated ${cnt} actions from ${prevVersion} to latest (${latestVersion}).`;