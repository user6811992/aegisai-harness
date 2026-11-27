// src/shortcut_debt.js
// Shortcut debt ledger — clean-room DietrichGebert/ponytail (MIT, 200k★)
// idea. Lists every `shortcut:` (and older `ponytail:`) comment in the repo so
// deferred limits stay visible. Read-only, no changes.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SKIP = new Set(['.git', 'node_modules', 'target', 'ggml', 'vendor']);

function scan(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) scan(p, out);
    else if (/\.(js|ts|json|md|yml|yaml)$/i.test(e.name)) {
      let lines;
      try { lines = fs.readFileSync(p, 'utf8').split(/\r?\n/); } catch (err) { continue; }
      lines.forEach((line, i) => {
        const m = line.match(/shortcut:\s*(.*)|ponytail:\s*(.*)/i);
        if (m) out.push({ file: path.relative(ROOT, p).replace(/\\/g, '/'), line: i + 1, text: (m[1] || m[2] || '').trim() });
      });
    }
  }
  return out;
}
function ledger(opts) {
  const out = scan(ROOT, []);
  return { ok: true, count: out.length, items: (opts && opts.all) ? out : out.slice(0, (opts && opts.limit) || 50) };
}
function tools() {
  return [{ name: 'shortcut_debt', description: 'List deferred shortcut comments (debt ledger).', inputSchema: { type: 'object' } }];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'shortcut_debt') return ledger(args);
  throw new Error('unknown shortcut_debt tool: ' + name);
}
module.exports = { scan, ledger, tools, dispatch };
