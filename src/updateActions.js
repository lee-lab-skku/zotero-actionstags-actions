const SOURCE_URL = 'https://cdn.skypack.dev/-/js-yaml@v4.1.1-8B0j8wiUmEXyI4j5ClPv/dist=es2019,mode=imports/optimized/js-yaml.js';
const TARGET_URL = 'https://api.github.com/repos/lee-lab-skku/zotero-actionstags-actions/releases/latest';
const TARGET_FILE_NAME = 'zotero-actionstags-backup.yml';

const j = await fetch(TARGET_URL).then(res => res.json());
const assetUrl = j.assets.find(asset => asset.name === TARGET_FILE_NAME).browser_download_url;
const actions = await fetch(assetUrl).then(res => res.text());

let code = await fetch(SOURCE_URL).then(res => res.text());
code=code.replace(/export\s+default\s+[^;]+;|export\s*\{[^}]*\};?/g, "");

sb = Cu.Sandbox(Services.scriptSecurityManager.getSystemPrincipal());
Cu.evalInSandbox(code, sb);

sb.load('');