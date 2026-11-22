// src/mcpb.js
// Desktop extensions (.mcpb): one-click local MCP server install bundles (modelcontextprotocol/mcpb).
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

function install(bundlePath) {
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(bundlePath, 'utf8')); } catch (e) { return { ok: false, error: 'invalid bundle: ' + e.message }; }
  if (!manifest.name || !manifest.command) return { ok: false, error: 'bundle missing name/command' };
  const dir = path.join(DATA_DIR, 'mcpb', manifest.name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  // register in mcp config (stdio)
  const cfg = { name: manifest.name, transport: 'stdio', command: manifest.command, args: manifest.args || [] };
  try { require('./integrations/mcp').saveConfig ? require('./integrations/mcp').saveConfig(cfg) : null; } catch (e) {}
  return { ok: true, name: manifest.name, dir, config: cfg };
}
function list() {
  const base = path.join(DATA_DIR, 'mcpb');
  try { return fs.readdirSync(base).filter((d) => fs.statSync(path.join(base, d)).isDirectory()).map((d) => { try { return JSON.parse(fs.readFileSync(path.join(base, d, 'manifest.json'), 'utf8')); } catch (e) { return { name: d }; } }); } catch (e) { return []; }
}

module.exports = { install, list };
