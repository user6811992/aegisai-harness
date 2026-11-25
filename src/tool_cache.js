// src/tool_cache.js
// In-session tool result cache. Caches deterministic tool calls (reads, searches)
// so repeated identical calls within a session return the cached result.
const crypto = require('crypto');

const CACHEABLE = new Set([
  'read_file', 'search_files', 'search_codebase', 'get_repo_map', 'list_files',
  'get_state', 'browser_snapshot', 'recall_archived_context',
]);

// Tools that can mutate the filesystem or state — invalidate cache on these.
const MUTATING = new Set(['write_file', 'delete_file', 'edit_file', 'run_command']);

const cache = new Map(); // key -> { result, ts, hits }
const TTL_MS = 60000; // 1 minute

function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function keyFor(name, args, projectRoot) {
  const normalized = stableStringify({ n: name, a: args || {}, p: projectRoot || '' });
  return crypto.createHash('sha1').update(normalized).digest('hex');
}

function isCacheable(name) {
  return CACHEABLE.has(name);
}

function isMutating(name) {
  return MUTATING.has(name);
}

function get(name, args, projectRoot) {
  if (!isCacheable(name)) return null;
  const k = keyFor(name, args, projectRoot);
  const entry = cache.get(k);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) { cache.delete(k); return null; }
  entry.hits++;
  return entry.result;
}

function set(name, args, result, projectRoot) {
  if (!isCacheable(name)) return;
  // Do not cache failures.
  if (result && result.ok === false) return;
  const k = keyFor(name, args, projectRoot);
  cache.set(k, { result, ts: Date.now(), hits: 0 });
}

function invalidate(name, projectRoot) {
  if (isMutating(name)) {
    cache.clear();
  }
}

function clear() { cache.clear(); }

function stats() {
  let hits = 0, entries = cache.size;
  for (const v of cache.values()) hits += v.hits;
  return { entries, hits, cacheable: Array.from(CACHEABLE) };
}

module.exports = { get, set, clear, stats, isCacheable, isMutating, invalidate, CACHEABLE, MUTATING };