// src/memory_bridge.js
// Shared memory-file bridge — clean-room alesha-pro/claude-memory-bridge idea.
// Harness-agnostic live memory files, no DB, no embeddings, no copy drift.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { DATA_DIR } = require('./core/config');

const MEMORY_NAME = 'MEMORY.md';
const MAX_INDEX_BYTES = 25 * 1024;
const MAX_INDEX_LINES = 200;

function memoryDir(custom) {
  return custom || path.join(DATA_DIR, 'shared-memory');
}

function init(custom) {
  const dir = memoryDir(custom);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, MEMORY_NAME);
  if (!fs.existsSync(p)) fs.writeFileSync(p, '# Shared Memory Index\n\n<!-- 200 lines / 25 KB cap -->\n');
  return { ok: true, dir, index: p };
}

function readIndex(custom) {
  const p = path.join(memoryDir(custom), MEMORY_NAME);
  if (!fs.existsSync(p)) return { ok: false, error: 'memory index not found; call memory_bridge_init' };
  const text = fs.readFileSync(p, 'utf8');
  return { ok: true, text, lines: text.split(/\r?\n/).length, bytes: Buffer.byteLength(text) };
}

function appendNote(name, content, custom) {
  const dir = memoryDir(custom);
  fs.mkdirSync(dir, { recursive: true });
  const safe = String(name || 'note').replace(/[^a-zA-Z0-9._-]/g, '_') + '.md';
  const p = path.join(dir, safe);
  fs.writeFileSync(p, String(content || ''));
  const idx = path.join(dir, MEMORY_NAME);
  let text = fs.existsSync(idx) ? fs.readFileSync(idx, 'utf8') : '# Shared Memory Index\n';
  const line = `- [[${safe.replace(/\.md$/, '')}]] — ${String(content || '').split(/\r?\n/)[0].slice(0, 80)}`;
  if (!text.includes(line)) text += `\n${line}`;
  const lines = text.split(/\r?\n/);
  if (lines.length > MAX_INDEX_LINES || Buffer.byteLength(text) > MAX_INDEX_BYTES) {
    return { ok: true, path: p, indexWarning: 'index exceeds cap; prune it' };
  }
  fs.writeFileSync(idx, text);
  return { ok: true, path: p, index: idx };
}

function notes(custom) {
  const dir = memoryDir(custom);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== MEMORY_NAME);
}

function tools() {
  return [
    { name: 'memory_bridge_init', description: 'Initialize a harness-agnostic shared memory index.', inputSchema: { type: 'object', properties: { dir: { type: 'string' } } } },
    { name: 'memory_bridge_read', description: 'Read the shared memory index.', inputSchema: { type: 'object', properties: { dir: { type: 'string' } } } },
    { name: 'memory_bridge_append', description: 'Append a note and link it in the index.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, content: { type: 'string' }, dir: { type: 'string' } }, required: ['name'] } },
    { name: 'memory_bridge_list', description: 'List shared memory notes.', inputSchema: { type: 'object' } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'memory_bridge_init') return init(args.dir);
  if (name === 'memory_bridge_read') return readIndex(args.dir);
  if (name === 'memory_bridge_append') return appendNote(args.name, args.content, args.dir);
  if (name === 'memory_bridge_list') return { ok: true, notes: notes(args.dir) };
  throw new Error('unknown memory_bridge tool: ' + name);
}
module.exports = { MEMORY_NAME, memoryDir, init, readIndex, appendNote, notes, tools, dispatch };
