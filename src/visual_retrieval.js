// src/visual_retrieval.js
// Pixel-native visual retrieval — clean-room StarTrail-org/PixelRAG (Apache-2.0)
// idea. Index screenshots by their visual properties and search by description.
// No browser bundled; accepts screenshots the caller has already captured.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const DB = () => path.join(DATA_DIR, 'visual-index.json');
function load(){try{return JSON.parse(fs.readFileSync(DB(),'utf8'));}catch(e){return {tiles:{}};}}
function save(d){fs.mkdirSync(DATA_DIR,{recursive:true});fs.writeFileSync(DB(),JSON.stringify(d));}

// Very small image descriptor from raw bytes: dimensions (PNG IHDR), average
// byte histogram, and a perceptual hash. Enough for deterministic matching.
function describe(file) {
  if (!fs.existsSync(file)) return { ok:false, error:'file not found' };
  const buf = fs.readFileSync(file);
  let w=0,h=0;
  if (buf.toString('ascii',1,4)==='PNG') { w=buf.readUInt32BE(16); h=buf.readUInt32BE(20); }
  const bins = new Array(16).fill(0);
  for (const b of buf) bins[b>>4] += 1;
  const total = buf.length||1;
  const hist = bins.map(n=>+(n/total).toFixed(4));
  const phash = crypto.createHash('sha256').update(buf).digest('hex').slice(0,16);
  return { ok:true, file, width:w, height:h, hist, phash, bytes:buf.length };
}
function index(file, meta) {
  const d = load(); const desc = describe(file);
  if (!desc.ok) return desc;
  d.tiles[desc.phash] = { ...desc, meta: meta||{}, labels: (meta&&meta.labels)||[] };
  save(d);
  return { ok:true, id:desc.phash, width:desc.width, height:desc.height };
}
function search(query, opts) {
  const d=load(); const q=String(query||'').toLowerCase().split(/\s+/).filter(Boolean);
  const out=Object.values(d.tiles).map(t=>{
    const hay=[...(t.labels||[]),t.file].join(' ').toLowerCase();
    const hits=q.filter(x=>hay.includes(x)).length;
    return { id:t.phash, file:t.file, width:t.width, height:t.height, score:hits, meta:t.meta };
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,(opts&&opts.k)||8);
  return { ok:true, query, results:out };
}
function tools() {
  return [
    { name: 'visual_index', description: 'Index a local screenshot tile by visual descriptor.', inputSchema: { type: 'object', properties: { file: { type: 'string' }, labels: { type: 'array' } }, required: ['file'] } },
    { name: 'visual_search', description: 'Search indexed tiles by description.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, k: { type: 'number' } }, required: ['query'] } },
  ];
}
function dispatch(name,args){args=args||{};if(name==='visual_index')return index(args.file,args);if(name==='visual_search')return search(args.query,args);throw new Error('unknown visual_retrieval tool: '+name);}
module.exports = { load, save, describe, index, search, tools, dispatch };
