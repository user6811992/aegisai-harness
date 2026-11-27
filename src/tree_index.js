// src/tree_index.js
// Reasoning-based vectorless index — clean-room VectifyAI/PageIndex (Apache-2.0),
// ConDB, and ChatIndex ideas. Build a hierarchical tree from documents or
// conversation turns; agents reason over the tree (like a table of contents)
// instead of vector similarity. No vector DB, no chunking, fully local.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./core/config');

const DB = () => path.join(DATA_DIR, 'tree-index.json');
function load() { try { return JSON.parse(fs.readFileSync(DB(), 'utf8')); } catch (e) { return { trees: {} }; } }
function save(d) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DB(), JSON.stringify(d)); }

// Build a tree from a markdown/plain document by headings.
function buildDocument(name, text, opts) {
  opts = opts || {};
  const lines = String(text || '').split(/\r?\n/);
  const nodes = [];
  let current = null;
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    const h = l.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      current = { id: nodes.length, title: h[2].trim(), level: h[1].length, startLine: i, lines: [] };
      nodes.push(current);
    } else if (current) current.lines.push(l);
  }
  if (!nodes.length) nodes.push({ id: 0, title: name, level: 1, startLine: 0, lines: lines.slice(0, opts.maxLines || 5000) });
  return { id: 'doc_' + crypto.randomBytes(4).toString('hex'), name, kind: 'document', built: new Date().toISOString(), nodes: nodes.map((n, i) => ({ ...n, id: i, text: n.lines.join('\n').slice(0, opts.nodeChars || 4000) })) };
}

// Build a tree from conversation turns (preserves raw history, multi-resolution).
function buildConversation(name, messages, opts) {
  const nodes = (messages || []).map((m, i) => ({
    id: i, role: m.role || 'unknown',
    title: String(m.content || '').split(/\r?\n/)[0].slice(0, 60),
    text: String(m.content || '').slice(0, (opts && opts.nodeChars) || 4000),
  }));
  return { id: 'chat_' + crypto.randomBytes(4).toString('hex'), name, kind: 'conversation', built: new Date().toISOString(), nodes };
}

function index(tree, opts) {
  const d = load();
  d.trees[tree.id] = tree;
  if (!opts || !opts.dryRun) save(d);
  return { ok: true, id: tree.id, nodes: tree.nodes.length, kind: tree.kind };
}

// Reasoning proxy: score nodes by term overlap + position; the agent makes the
// final relevance judgment (tree search), this just narrows candidates.
function search(query, opts) {
  opts = opts || {};
  const d = load();
  const trees = opts.id ? [d.trees[opts.id]] : Object.values(d.trees);
  const terms = String(query || '').toLowerCase().match(/[a-z0-9_]+/g) || [];
  const out = [];
  for (const tree of trees.filter(Boolean)) {
    for (const node of tree.nodes) {
      const text = String(node.text || '').toLowerCase();
      const hits = terms.filter((t) => text.includes(t)).length;
      if (hits > 0) out.push({ tree: tree.id, treeName: tree.name, node: node.id, title: node.title, level: node.level || 1, score: hits, preview: String(node.text || '').slice(0, opts.preview || 300) });
    }
  }
  return { ok: true, query, results: out.sort((a, b) => b.score - a.score).slice(0, opts.k || 10) };
}
function list() { const d = load(); return { ok: true, trees: Object.values(d.trees).map((t) => ({ id: t.id, name: t.name, kind: t.kind, nodes: t.nodes.length })) }; }

function tools() {
  return [
    { name: 'tree_index_document', description: 'Index a document as a reasoning-based heading tree.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, text: { type: 'string' } }, required: ['name','text'] } },
    { name: 'tree_index_conversation', description: 'Index conversation turns as a multi-resolution tree.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, messages: { type: 'array' } }, required: ['name'] } },
    { name: 'tree_search', description: 'Reason over indexed trees to find relevant nodes.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, k: { type: 'number' } }, required: ['query'] } },
    { name: 'tree_list', description: 'List indexed trees.', inputSchema: { type: 'object' } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'tree_index_document') return index(buildDocument(args.name, args.text, args), args);
  if (name === 'tree_index_conversation') return index(buildConversation(args.name, args.messages, args), args);
  if (name === 'tree_search') return search(args.query, args);
  if (name === 'tree_list') return list();
  throw new Error('unknown tree_index tool: ' + name);
}
module.exports = { load, save, buildDocument, buildConversation, index, search, list, tools, dispatch };
