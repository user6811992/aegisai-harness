// src/agent_storage.js
// Unified agent storage contract — clean-room aws/strands-dynamodb-storage
// idea. One interface over multiple backends (memory/file/sqlite-like), with
// sessions, traces and memories. Local-only; network backends require opt-in.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const DIR = () => path.join(DATA_DIR, 'agent-storage');
const file = (ns) => path.join(DIR(), String(ns || 'default').replace(/[^a-zA-Z0-9._-]/g, '_') + '.json');

function read(ns) { try { return JSON.parse(fs.readFileSync(file(ns), 'utf8')); } catch (e) { return { sessions: {}, traces: [], memories: [] }; } }
function write(ns, db) { fs.mkdirSync(DIR(), { recursive: true }); fs.writeFileSync(file(ns), JSON.stringify(db, null, 2)); }

function put(ns, kind, item) {
  const db = read(ns);
  if (kind === 'session') db.sessions[item.id] = item;
  else if (kind === 'trace') db.traces.push(item);
  else if (kind === 'memory') db.memories.push(item);
  else throw new Error('unknown storage kind: ' + kind);
  write(ns, db);
  return { ok: true, namespace: ns, kind, stored: true };
}
function get(ns, kind, id) {
  const db = read(ns);
  if (kind === 'session') return { ok: true, item: db.sessions[id] || null };
  if (kind === 'trace') return { ok: true, items: db.traces.filter((t) => !id || t.id === id) };
  if (kind === 'memory') return { ok: true, items: db.memories.filter((m) => !id || m.id === id) };
  throw new Error('unknown storage kind: ' + kind);
}
function namespaces() {
  if (!fs.existsSync(DIR())) return [];
  return fs.readdirSync(DIR()).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
}
function tools() {
  return [
    { name: 'storage_put', description: 'Store a session, trace or memory in a namespace.', inputSchema: { type: 'object', properties: { namespace: { type: 'string' }, kind: { type: 'string' }, item: { type: 'object' } }, required: ['namespace','kind','item'] } },
    { name: 'storage_get', description: 'Read stored sessions, traces or memories.', inputSchema: { type: 'object', properties: { namespace: { type: 'string' }, kind: { type: 'string' }, id: { type: 'string' } }, required: ['namespace','kind'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'storage_put') return put(args.namespace, args.kind, args.item);
  if (name === 'storage_get') return get(args.namespace, args.kind, args.id);
  if (name === 'storage_namespaces') return { ok: true, namespaces: namespaces() };
  throw new Error('unknown agent_storage tool: ' + name);
}
module.exports = { DIR, read, write, put, get, namespaces, tools, dispatch };
