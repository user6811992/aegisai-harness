// src/code_graph.js
// Ix-style system intelligence graph — clean-room ix-infrastructure/Ix (Apache-2.0)
// idea. Parses local JS/TS files into a persistent graph of symbols, imports and
// relationships, so agents query structure instead of grepping. No deps.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./core/config');

const DB_FILE = () => path.join(DATA_DIR, 'code-graph.json');

function load() { try { return JSON.parse(fs.readFileSync(DB_FILE(), 'utf8')); } catch (e) { return { files: {}, symbols: [], edges: [] }; } }
function save(g) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DB_FILE(), JSON.stringify(g)); }

const SKIP = new Set(['node_modules', '.git', 'vendor', 'ggml', 'target', 'dist', 'coverage']);
function jsFiles(dir, limit) {
  const out = [];
  function walk(d, depth) {
    if (depth > 8 || out.length >= (limit || 2000)) return;
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(path.join(d, e.name), depth + 1); continue; }
      if (/\.(js|ts|tsx|mjs|cjs)$/i.test(e.name)) out.push(path.join(d, e.name));
    }
  }
  walk(dir, 0);
  return out;
}

function map(dir, opts) {
  opts = opts || {};
  const g = { built: new Date().toISOString(), root: dir, files: {}, symbols: [], edges: [] };
  for (const file of jsFiles(dir, opts.maxFiles)) {
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch (e) { continue; }
    const rel = path.relative(dir, file).replace(/\\/g, '/');
    const symbols = [];
    // functions/classes
    const fnRe = /(?:^|\n)\s*(?:export\s+)?(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/g;
    let m;
    while ((m = fnRe.exec(text))) symbols.push({ name: m[1], kind: /class/.test(m[0]) ? 'class' : 'function', file: rel });
    // arrow consts
    const arRe = /(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
    while ((m = arRe.exec(text))) symbols.push({ name: m[1], kind: 'function', file: rel });
    // imports / requires
    const edges = [];
    const reqRe = /require\(['"]([^'"]+)['"]\)|from\s+['"]([^'"]+)['"]/g;
    while ((m = reqRe.exec(text))) {
      const target = m[1] || m[2];
      edges.push({ from: rel, to: target, type: target.startsWith('.') ? 'import' : 'external' });
    }
    g.files[rel] = { bytes: text.length, symbols: symbols.length, hash: crypto.createHash('md5').update(text).digest('hex').slice(0, 8) };
    g.symbols.push(...symbols);
    g.edges.push(...edges);
  }
  if (!opts.dryRun) save(g);
  return { ok: true, root: dir, files: Object.keys(g.files).length, symbols: g.symbols.length, edges: g.edges.length, dryRun: !!opts.dryRun };
}

function explain(name) {
  const g = load();
  const syms = g.symbols.filter((s) => s.name.toLowerCase() === String(name || '').toLowerCase());
  const files = Array.from(new Set(syms.map((s) => s.file)));
  const touched = g.edges.filter((e) => files.includes(e.from) || e.to.includes(String(name || ''))).slice(0, 30);
  return { ok: syms.length > 0, name, symbols: syms.slice(0, 20), files, connections: touched };
}
function trace(name) { return explain(name); }
function impact(name) {
  const e = explain(name);
  return Object.assign({}, e, { impact: e.files, note: 'files that define or import this symbol' });
}
function stats() { const g = load(); return { ok: true, built: g.built, files: Object.keys(g.files).length, symbols: g.symbols.length, edges: g.edges.length }; }

function tools() {
  return [
    { name: 'code_graph_map', description: 'Build a persistent system graph of a local codebase.', inputSchema: { type: 'object', properties: { dir: { type: 'string' }, dryRun: { type: 'boolean' } }, required: ['dir'] } },
    { name: 'code_graph_explain', description: 'Explain a symbol from the code graph.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
    { name: 'code_graph_impact', description: 'Find files affected by changing a symbol.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
    { name: 'code_graph_stats', description: 'Show code graph statistics.', inputSchema: { type: 'object' } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'code_graph_map') return map(args.dir, args);
  if (name === 'code_graph_explain') return explain(args.name);
  if (name === 'code_graph_trace') return trace(args.name);
  if (name === 'code_graph_impact') return impact(args.name);
  if (name === 'code_graph_stats') return stats();
  throw new Error('unknown code_graph tool: ' + name);
}
module.exports = { load, save, map, explain, trace, impact, stats, tools, dispatch };
