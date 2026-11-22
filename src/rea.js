// src/rea.js
// REA (Reverse Engineering Anything) native integration: 255-tool RE agent.
const { spawnSync } = require('child_process');
const fs = require('fs');

function binary() { return process.env.REA_BIN || ''; }
function available() { const b = binary(); if (!b) return false; try { return fs.existsSync(b); } catch (e) { return false; } }
function version() {
  const b = binary();
  if (!b) return { ok: false, error: 'REA_BIN not set' };
  try { const r = spawnSync(b, ['--version'], { encoding: 'utf8', timeout: 5000 }); return { ok: r.status === 0, version: (r.stdout || r.stderr || '').trim() }; } catch (e) { return { ok: false, error: String(e.message || e) }; }
}
function status() { return { available: available(), binary: binary(), version: version() }; }
function invoke(tool, args) {
  const b = binary();
  if (!b) return { ok: false, output: 'REA not configured (set REA_BIN)' };
  const argv = [tool, ...Object.entries(args || {}).flatMap(([k, v]) => ['--' + k, String(v)])];
  try { const r = spawnSync(b, argv, { encoding: 'utf8', timeout: 120000 }); return { ok: r.status === 0, output: (r.stdout || '') + (r.stderr || '') }; } catch (e) { return { ok: false, output: String(e.message || e) }; }
}
const TOOLS = [
  { type: 'function', function: { name: 'rea_inspect_binary', description: 'Inspect a binary (ELF/PE/Mach-O): sections, symbols, mitigations.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'rea_decompile', description: 'Decompile a function by address/name in a binary.', parameters: { type: 'object', properties: { path: { type: 'string' }, function: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'rea_strings', description: 'Extract strings from a binary.', parameters: { type: 'object', properties: { path: { type: 'string' }, min: { type: 'number' } }, required: ['path'] } } },
];

module.exports = { binary, available, version, status, invoke, TOOLS };
