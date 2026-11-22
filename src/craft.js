// src/craft.js
// Craft Anything native integration: 320 RE tools (native, .NET, Java, Android, Apple, Electron/JS, websites, firmware, packets, DBs, game files).
const fs = require('fs');

function binary() { return process.env.CRAFT_BIN || ''; }
function available() { const b = binary(); if (!b) return false; try { return fs.existsSync(b); } catch (e) { return false; } }
function status() { return { available: available(), binary: binary(), note: 'set CRAFT_BIN to craft-anything-cli' }; }
const TOOLS = [
  { type: 'function', function: { name: 'craft_unpack', description: 'Unpack/analyze a file with Craft Anything (auto-detect format).', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'craft_strings', description: 'Extract strings via Craft.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'craft_decompile', description: 'Decompile via Craft.', parameters: { type: 'object', properties: { path: { type: 'string' }, function: { type: 'string' } }, required: ['path'] } } },
];
function invoke(tool, args) {
  const b = binary();
  if (!b) return { ok: false, output: 'Craft not configured (set CRAFT_BIN)' };
  const argv = [tool.replace('craft_', ''), ...Object.entries(args || {}).flatMap(([k, v]) => ['--' + k, String(v)])];
  const { spawnSync } = require('child_process');
  try { const r = spawnSync(b, argv, { encoding: 'utf8', timeout: 120000 }); return { ok: r.status === 0, output: (r.stdout || '') + (r.stderr || '') }; } catch (e) { return { ok: false, output: String(e.message || e) }; }
}

module.exports = { binary, available, status, invoke, TOOLS };
