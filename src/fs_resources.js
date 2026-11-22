// src/fs_resources.js
// Filesystem Resources extension: expose local files as MCP resources (modelcontextprotocol/experimental-ext-filesystems).
const fs = require('fs');
const path = require('path');

function list(root, prefix) {
  root = root || process.cwd();
  const out = [];
  function walk(dir, depth) {
    if (depth > 4) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (['node_modules', '.git', 'data', 'dist'].includes(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (/\.(md|txt|json|js|ts|py|yaml|yml|toml)$/i.test(e.name)) {
        out.push({ uri: 'file://' + p.replace(/\\/g, '/'), name: e.name, path: p, mimeType: mimeFor(e.name) });
      }
    }
  }
  walk(root, 0);
  return prefix ? out.filter((r) => r.uri.startsWith(prefix)) : out;
}
function read(uri) {
  const p = uri.replace(/^file:\/\//, '');
  try { return { uri, text: fs.readFileSync(p, 'utf8').slice(0, 50000), mimeType: mimeFor(path.basename(p)) }; } catch (e) { return { uri, error: String(e.message || e) }; }
}
function mimeFor(name) {
  if (/\.(md|txt)$/i.test(name)) return 'text/plain';
  if (/\.json$/i.test(name)) return 'application/json';
  if (/\.(js|ts)$/i.test(name)) return 'text/javascript';
  if (/\.(py)$/i.test(name)) return 'text/x-python';
  return 'application/octet-stream';
}

module.exports = { list, read, mimeFor };
