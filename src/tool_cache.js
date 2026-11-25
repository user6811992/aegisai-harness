// src/tool_cache.js
// In-session tool result cache. Caches deterministic tool calls (reads, searches)
// so repeated identical calls within a session return the cached result.
const crypto = require('crypto');

const CACHEABLE = new Set([
  'read_file', 'search_files', 'search_codebase', 'get_repo_map', 'list_files',
  'get_state', 'browser_snapshot', 'recall_archived_context',
]);

const cache = new Map(); // key -> { result, ts, hits }
const TTL_MS = 60000; // 1 minute

function keyFor(name, args) {
  const normalized = JSON.stringify({ n: name, a: args || {} }, Object.keys(args || {}).sort());
  return crypto.createHash('sha1').update(normalized).digest('hex');
}

function isCacheable(name) {
  return CACHEABLE.has(name);
}

function get(name, args) {
  if (!isCacheable(name)) return null;
  const k = keyFor(name, args);
  const entry = cache.get(k);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) { cache.delete(k); return null; }
  entry.hits++;
  return entry.result;
}

function set(name, args, result) {
  if (!isCacheable(name)) return;
  const k = keyFor(name, args);
  cache.set(k, { result, ts: Date.now(), hits: 0 });
}

function invalidate(name) {
  // Invalidate all entries for a given tool name (e.g., after a write).
  for (const [k, v] of cache) {
    // We don't store name in key easily; recompute by checking. Simpler: clear all on write tools.
  }
  // Simpler: clear entire cache on any write tool call.
  cache.clear();
}

function clear() { cache.clear(); }

function stats() {
  let hits = 0, entries = cache.size;
  for (const v of cache.values()) hits += v.hits;
  return { entries, hits, cacheable: Array.from(CACHEABLE) };
}

module.exports = { get, set, clear, stats, isCacheable, invalidate, CACHEABLE };