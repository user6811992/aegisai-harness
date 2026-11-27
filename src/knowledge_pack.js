// src/knowledge_pack.js
// Offline portable knowledge pack — clean-room gabrielursan-beep/red-alert-llm
// (MIT) idea. Bundle a curated corpus + a manifest into one portable folder or
// JSON file that works with no network. Distinct from generic KB: emphasis on
// a self-contained, versioned, offline-first package.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./core/config');
const DIR = () => path.join(DATA_DIR, 'knowledge-packs');

function build(name, docs, opts) {
  opts = opts || {};
  const files = (docs || []).map((d) => {
    const text = String(d.text || '');
    return { id: d.id || crypto.createHash('md5').update(text).digest('hex').slice(0, 8), title: d.title || '', text, words: text.split(/\s+/).length };
  });
  const manifest = {
    type: 'aegisai-knowledge-pack', version: 1, name: String(name || 'pack'),
    built: new Date().toISOString(), count: files.length,
    totalWords: files.reduce((a, f) => a + f.words, 0),
    hash: crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex'),
    offline: true, files,
  };
  fs.mkdirSync(DIR(), { recursive: true });
  const p = path.join(DIR(), manifest.name.replace(/[^a-zA-Z0-9._-]/g, '_') + '.json');
  fs.writeFileSync(p, JSON.stringify(manifest, null, 2));
  return { ok: true, path: p, ...manifest };
}

function verify(manifest) {
  const expected = crypto.createHash('sha256').update(JSON.stringify(manifest.files)).digest('hex');
  return { ok: expected === manifest.hash, hashValid: expected === manifest.hash, count: manifest.count, offline: true };
}
function list() {
  if (!fs.existsSync(DIR())) return [];
  return fs.readdirSync(DIR()).filter((f) => f.endsWith('.json')).map((f) => {
    try { const m = JSON.parse(fs.readFileSync(path.join(DIR(), f), 'utf8')); return { name: m.name, count: m.count, hash: m.hash }; }
    catch (e) { return null; }
  }).filter(Boolean);
}

function tools() {
  return [
    { name: 'knowledge_pack_build', description: 'Build an offline portable knowledge pack.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, docs: { type: 'array' } }, required: ['name','docs'] } },
    { name: 'knowledge_pack_verify', description: 'Verify a knowledge pack manifest hash.', inputSchema: { type: 'object', properties: { manifest: { type: 'object' } }, required: ['manifest'] } },
    { name: 'knowledge_pack_list', description: 'List built knowledge packs.', inputSchema: { type: 'object' } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'knowledge_pack_build') return build(args.name, args.docs, args);
  if (name === 'knowledge_pack_verify') return verify(args.manifest);
  if (name === 'knowledge_pack_list') return { ok: true, packs: list() };
  throw new Error('unknown knowledge_pack tool: ' + name);
}
module.exports = { DIR, build, verify, list, tools, dispatch };
