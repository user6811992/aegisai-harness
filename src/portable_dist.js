// src/portable_dist.js
// Single-file portable distribution — clean-room mozilla-ai/llamafile +
// llamafile-builder idea. Produces a manifest for one self-contained executable
// (runtime + weights + launcher). No binaries bundled; opt-in build only.
const crypto = require('crypto');

function manifest(name, parts, opts) {
  opts = opts || {};
  const files = (parts || []).map((p) => ({ path: p.path || String(p), bytes: p.bytes || 0, role: p.role || 'asset' }));
  const total = files.reduce((a, f) => a + f.bytes, 0);
  return {
    ok: true,
    name: String(name || 'aegisai-portable'),
    type: 'aegisai-portable-executable',
    version: 1,
    target: opts.target || process.platform + '-' + process.arch,
    files,
    totalBytes: total,
    hash: crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex'),
    note: 'caller assembles the single file with llamafile-builder; no download here',
  };
}
function tools() {
  return [{ name: 'portable_manifest', description: 'Build a single-file portable distribution manifest.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, parts: { type: 'array' } }, required: ['name'] } }];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'portable_manifest') return manifest(args.name, args.parts, args);
  throw new Error('unknown portable_dist tool: ' + name);
}
module.exports = { manifest, tools, dispatch };
