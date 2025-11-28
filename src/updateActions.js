const SOURCE_URL = 'https://cdn.skypack.dev/-/js-yaml@v4.1.1-8B0j8wiUmEXyI4j5ClPv/dist=es2019,mode=imports/optimized/js-yaml.js';
const code = await fetch(SOURCE_URL).then(res => res.text());
code=code.replace(/export\s+default\s+[^;]+;|export\s*\{[^}]*\};?/g, "");

sb = Cu.Sandbox(Services.scriptSecurityManager.getSystemPrincipal());
Cu.evalInSandbox(code, sb);

sb.load('');