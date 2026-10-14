const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '../..');
const generated = path.join(root, 'coverage', 'action-sources', 'src');
fs.mkdirSync(generated, { recursive: true });

// Preserve columns as well as lines: several guards occupy one source line.
function vlq(value) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let encoded = '', bits = value < 0 ? (-value * 2 + 1) : value * 2;
    do {
        let digit = bits % 32;
        bits = Math.floor(bits / 32);
        if (bits) digit |= 32;
        encoded += alphabet[digit];
    } while (bits);
    return encoded;
}
function actionMappings(body, original) {
    const originals = original.split('\n');
    let previousColumn = 0;
    const lines = body.split('\n').map((line, index) => {
        const first = 'AA' + vlq(index ? 1 : 0) + vlq(-previousColumn);
        const columns = Math.max(0, line.length - 1);
        previousColumn = Math.min(columns, Math.max(0, originals[index].length - 1));
        return first + ',CAAC'.repeat(previousColumn) + ',CAAA'.repeat(columns - previousColumn);
    });
    // Map the scaffolding's boundaries to the body's boundaries, so V8's
    // whole-script/function ranges remain valid after remapping.
    return ['AAAA', ...lines, 'AAAA', 'AAAA'].join(';');
}

// A&T 2.6.2 applyAction chooses injected arguments from the persisted event,
// including startup's lack of item/items and the load event's own window.
function compileAction(name, body) {
    const filename = path.join(root, 'src', name + '.js');
    const original = fs.readFileSync(filename, 'utf8').trimEnd();
    body ??= original;
    body = body.trimEnd();
    const meta = fs.readFileSync(path.join(root, 'meta', name + '.yml'), 'utf8');
    const event = Number(/^event:\s*(\d+)/m.exec(meta)[1]);
    const parameters = event === 8 ? [] : event === 9 || event === 10
        ? ['window'] : ['item', 'items', 'collection'];
    parameters.push('require', 'triggerType', 'Date');
    const constants = {};
    if (name === 'updateActions') {
        for (const constant of ['INSTALLED_VERSION', 'SOURCE_REPOSITORY']) {
            const pattern = new RegExp('const ' + constant + ' = (.+);');
            const literal = pattern.exec(body)[1];
            constants[constant] = literal.startsWith("'") ? literal.slice(1, -1) : JSON.parse(literal);
            parameters.push('__test_' + constant);
            body = body.replace(pattern, 'const ' + constant + ' = __test_' + constant + ';');
        }
    }
    const digest = createHash('sha256').update(JSON.stringify([original, body, parameters])).digest('hex').slice(0, 16);
    const compiled = path.join(generated, name + '-' + digest + '.js');
    if (!fs.existsSync(compiled)) {
        // CommonJS lets Node register this inline map. VM filenames alone leave
        // V8 offsets shifted by the async wrapper and misreport uncovered lines.
        const sourceMap = {
            version: 3, sources: [pathToFileURL(filename).href], sourcesContent: [original], names: [],
            mappings: actionMappings(body, original),
        };
        const pending = compiled + '.' + process.pid + '.tmp';
        fs.writeFileSync(pending,
            'module.exports = async function(' + parameters.join(', ') + ') {\n' + body + '\n};\n'
            + '//# sourceMappingURL=data:application/json;base64,'
            + Buffer.from(JSON.stringify(sourceMap)).toString('base64'));
        fs.renameSync(pending, compiled);
    }
    const fn = require(compiled);
    return (modules, args = {}) => {
        const values = { item: null, items: [], collection: false, Date, ...args,
            require: key => {
                if (!(key in modules)) throw new Error('Unexpected injected module: ' + key);
                return modules[key];
            } };
        return fn(...parameters.map(key => key.startsWith('__test_') ? constants[key.slice(7)] : values[key]));
    };
}

module.exports = { compileAction };
