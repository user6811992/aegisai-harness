// src/hybrid_search.js
// XERJ-style unified local retrieval: BM25 (lexical) + kNN (dense) + hybrid
// reciprocal-rank fusion. Clean-room implementation of ideas from
// xerj-org/xerj (Apache-2.0): one engine indexes code/docs/logs/JSONL/CSV/PDF
// text with BM25 + kNN + hybrid, no external deps, no network, no embeddings
// API. Designed to replace naive substring search with measured retrieval and
// fewer output tokens (return only top-k passages).
const fs = require('fs');
const path = require('path');
const { embed, cosine } = require('./semantic_tools');

// ---- Tokenization ----
function tokenize(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9_]+/g) || [];
}

// ---- BM25 ----
class BM25 {
  constructor(opts) {
    opts = opts || {};
    this.k1 = opts.k1 || 1.5;
    this.b = opts.b || 0.75;
    this.docs = [];       // { id, text, tokens, meta }
    this.tf = [];         // Map<term, count>
    this.df = new Map();  // term -> docs containing it
    this.avgLen = 0;
  }
  add(id, text, meta) {
    const tokens = tokenize(text);
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) this.df.set(t, (this.df.get(t) || 0) + 1);
    this.docs.push({ id, text: String(text || ''), tokens, tf, meta: meta || {} });
    this.avgLen = this.docs.reduce((a, d) => a + d.tokens.length, 0) / this.docs.length;
    return this.docs.length - 1;
  }
  score(query, index) {
    const d = this.docs[index];
    if (!d) return 0;
    let s = 0;
    const q = tokenize(query);
    for (const term of q) {
      const f = d.tf.get(term) || 0;
      if (!f) continue;
      const n = this.df.get(term) || 0;
      const idf = Math.log(1 + (this.docs.length - n + 0.5) / (n + 0.5));
      const len = d.tokens.length || 1;
      s += idf * (f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + this.b * len / (this.avgLen || 1)));
    }
    return s;
  }
  search(query, k) {
    const out = this.docs.map((d, i) => ({ index: i, score: this.score(query, i) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k || 10);
    return out.map((x) => Object.assign({ id: this.docs[x.index].id, text: this.docs[x.index].text, meta: this.docs[x.index].meta }, x));
  }
}

// ---- Dense kNN (feature-hash embeddings, no model needed) ----
function knnSearch(items, query, k) {
  const q = embed(query);
  return items.map((it, i) => ({ i, score: cosine(q, embed(it.text)) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k || 10)
    .map((x) => Object.assign({ index: x.i, id: items[x.i].id, text: items[x.i].text, meta: items[x.i].meta || {} }, x));
}

// ---- Reciprocal Rank Fusion ----
function rrf(lists, k) {
  const RRF_K = k || 60;
  const scores = new Map();
  const byId = new Map();
  for (const list of lists) {
    list.forEach((item, rank) => {
      const key = item.id != null ? item.id : item.index;
      scores.set(key, (scores.get(key) || 0) + 1 / (RRF_K + rank + 1));
      byId.set(key, item);
    });
  }
  return Array.from(scores.entries())
    .map(([key, score]) => Object.assign({ id: key, score }, byId.get(key)))
    .sort((a, b) => b.score - a.score);
}

// ---- Unified index ----
class HybridIndex {
  constructor(opts) { this.bm25 = new BM25(opts); this.items = []; }
  add(id, text, meta) {
    this.bm25.add(id, text, meta);
    this.items.push({ id, text: String(text || ''), meta: meta || {} });
    return this.items.length;
  }
  search(query, opts) {
    opts = opts || {};
    const k = opts.k || 10;
    const mode = opts.mode || 'hybrid';
    if (mode === 'bm25') return this.bm25.search(query, k);
    if (mode === 'knn') return knnSearch(this.items, query, k);
    const a = this.bm25.search(query, k);
    const b = knnSearch(this.items, query, k);
    return rrf([a, b], opts.rrfK).slice(0, k);
  }
  get size() { return this.items.length; }
}

// ---- ingest local files (code/docs/logs/JSONL/CSV) ----
function ingestDir(dir, opts) {
  opts = opts || {};
  const idx = new HybridIndex(opts);
  if (!fs.existsSync(dir)) return idx;
  const exts = /\.(md|txt|js|ts|json|jsonl|csv|log|yaml|yml)$/i;
  let files = [];
  try { files = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return idx; }
  for (const e of files) {
    if (!e.isFile() || !exts.test(e.name)) continue;
    if (opts.glob && !e.name.includes(opts.glob)) continue;
    const p = path.join(dir, e.name);
    let text = '';
    try { text = fs.readFileSync(p, 'utf8'); } catch (err) { continue; }
    // JSONL: index each line as its own chunk; others: split into ~2KB passages
    if (/\.jsonl$/i.test(e.name)) {
      text.split(/\r?\n/).filter(Boolean).forEach((line, i) => idx.add(e.name + ':' + i, line, { file: p, line: i, type: 'jsonl' }));
    } else {
      const chunks = text.match(/[\s\S]{1,2000}/g) || [];
      chunks.forEach((chunk, i) => idx.add(e.name + ':' + i, chunk, { file: p, chunk: i }));
    }
  }
  return idx;
}

// ---- MCP surface ----
function tools() {
  return [
    { name: 'hybrid_index_build', description: 'Build an in-memory BM25+kNN index over a local directory.', inputSchema: { type: 'object', properties: { dir: { type: 'string' }, glob: { type: 'string' } }, required: ['dir'] } },
    { name: 'hybrid_search', description: 'Search the current hybrid index with BM25, kNN, or hybrid RRF fusion.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, mode: { type: 'string', enum: ['bm25', 'knn', 'hybrid'] }, k: { type: 'number' } }, required: ['query'] } },
  ];
}

let currentIndex = null;
function dispatch(name, args) {
  args = args || {};
  if (name === 'hybrid_index_build') {
    currentIndex = ingestDir(args.dir, args);
    return { ok: true, documents: currentIndex.size, dir: args.dir };
  }
  if (name === 'hybrid_search') {
    if (!currentIndex) return { ok: false, error: 'no index built; call hybrid_index_build first' };
    const results = currentIndex.search(args.query, args);
    return {
      ok: true,
      mode: args.mode || 'hybrid',
      count: results.length,
      results: results.slice(0, args.k || 10).map((r) => ({
        id: r.id, score: +(r.score || 0).toFixed(4),
        text: String(r.text || '').slice(0, 400), meta: r.meta,
      })),
    };
  }
  throw new Error('unknown hybrid_search tool: ' + name);
}

module.exports = { tokenize, BM25, knnSearch, rrf, HybridIndex, ingestDir, tools, dispatch };
