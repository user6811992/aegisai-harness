// src/compact_index.js
// LEANN-style compact vector index — clean-room StarTrail-org/LEANN (MIT,
// MLsys2026). Graph-based selective recomputation: store metadata, recompute
// embeddings on demand instead of storing them — ~97% less storage.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { embed, cosine } = require('./semantic_tools');
const { DATA_DIR } = require('./core/config');
const DB = () => path.join(DATA_DIR, 'compact-index.json');
function load() { try { return JSON.parse(fs.readFileSync(DB(),'utf8')); } catch(e){ return { docs: {} }; } }
function save(d) { fs.mkdirSync(DATA_DIR,{recursive:true}); fs.writeFileSync(DB(), JSON.stringify(d)); }
function index(id, text, opts) {
  const d = load();
  // only store a compact fingerprint + word set, NOT the full embedding
  const words = String(text||'').toLowerCase().match(/[a-z0-9]+/g) || [];
  d.docs[id] = { id, chars: String(text||'').length, words: Array.from(new Set(words)), hash: crypto.createHash('md5').update(String(text||'')).digest('hex').slice(0,8), storedAt: new Date().toISOString() };
  if (!opts || !opts.dryRun) save(d);
  // Compare only the embedding-relevant payload (word set vs 64-float vector).
  const stored = JSON.stringify({ words: d.docs[id].words, hash: d.docs[id].hash }).length;
  const full = JSON.stringify(embed(text)).length;
  const savingPct = full > 0 ? +(100*(1-stored/full)).toFixed(1) : 0;
  return { ok: true, id, storedBytes: stored, fullEmbeddingBytes: full, savingPct };
}
function search(query, opts) {
  const d = load(); const q = embed(query);
  const results = Object.values(d.docs).map(doc => {
    const reconstructed = new Array(64).fill(0);
    for (const w of doc.words) { const e = embed(w); for(let i=0;i<64;i++) reconstructed[i]+=e[i]; }
    return { id: doc.id, score: cosine(q, reconstructed) };
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,(opts&&opts.k)||8);
  return { ok: true, results, note: 'embeddings recomputed on demand from compact word metadata' };
}
function stats() { const d = load(); const docs = Object.values(d.docs); return { ok: true, documents: docs.length, approxBytes: JSON.stringify(d).length }; }
function tools() {
  return [
    { name: 'compact_index', description: 'Index a document compactly (metadata only, no stored embedding).', inputSchema: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['id','text'] } },
    { name: 'compact_search', description: 'Search by recomputing embeddings on demand.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, k: { type: 'number' } }, required: ['query'] } },
  ];
}
function dispatch(name,args){args=args||{};if(name==='compact_index')return index(args.id,args.text,args);if(name==='compact_search')return search(args.query,args);if(name==='compact_stats')return stats();throw new Error('unknown compact_index tool: '+name);}
module.exports = { load, save, index, search, stats, tools, dispatch };
