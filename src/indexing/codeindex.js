// src/indexing/codeindex.js
// Simple codebase indexer: walks a project, extracts symbols (functions/classes)
// via regex, stores in SQLite for keyword search.
const fs = require('fs');
const path = require('path');
const { safePath } = require('../core/security');

const EXT_LANG = { '.js': 'js', '.ts': 'ts', '.tsx': 'ts', '.jsx': 'js', '.py': 'py', '.go': 'go', '.rs': 'rs', '.java': 'java' };

function extractSymbols(content, lang) {
  const syms = [];
  const lines = content.split(/\r?\n/);
  const patterns = {
    js: [/^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/, /^\s*(?:export\s+)?class\s+(\w+)/, /^\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/],
    ts: [/^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/, /^\s*(?:export\s+)?class\s+(\w+)/, /^\s*(?:export\s+)?interface\s+(\w+)/, /^\s*(?:export\s+)?type\s+(\w+)/],
    py: [/^\s*def\s+(\w+)/, /^\s*class\s+(\w+)/],
    go: [/^\s*func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/, /^\s*type\s+(\w+)/],
    rs: [/^\s*(?:pub\s+)?fn\s+(\w+)/, /^\s*(?:pub\s+)?struct\s+(\w+)/, /^\s*(?:pub\s+)?enum\s+(\w+)/, /^\s*(?:pub\s+)?trait\s+(\w+)/],
    java: [/(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\(/, /^\s*(?:public|private|protected)?\s*class\s+(\w+)/],
  };
  const pats = patterns[lang] || patterns.js;
  lines.forEach((line, i) => {
    for (const p of pats) {
      const m = line.match(p);
      if (m && m[1]) { syms.push({ name: m[1], line: i + 1, kind: p.source.includes('class') ? 'class' : 'function' }); break; }
    }
  });
  return syms;
}

function walkFiles(root, out) {
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'data') continue;
    const full = path.join(root, e.name);
    if (e.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
}

function indexProject(projectRoot, db) {
  const files = [];
  walkFiles(projectRoot, files);
  let count = 0;
  const stmt = db.prepare ? db.prepare('INSERT OR REPLACE INTO code_symbols (id, project, path, symbol, kind, line) VALUES (?,?,?,?,?,?)') : null;
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    const lang = EXT_LANG[ext];
    if (!lang) continue;
    let content;
    try { content = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    if (content.includes('\0')) continue;
    const syms = extractSymbols(content, lang);
    const rel = path.relative(projectRoot, f);
    for (const s of syms) {
      const id = `${rel}:${s.line}:${s.name}`;
      if (stmt) stmt.run(id, projectRoot, rel, s.name, s.kind, s.line);
      else db.run('INSERT OR REPLACE INTO code_symbols (id, project, path, symbol, kind, line) VALUES (?,?,?,?,?,?)', [id, projectRoot, rel, s.name, s.kind, s.line]);
      count++;
    }
  }
  return count;
}

function searchIndex(db, query, limit) {
  limit = limit || 50;
  const like = '%' + query + '%';
  try {
    return db.prepare('SELECT path, symbol, kind, line FROM code_symbols WHERE symbol LIKE ? OR path LIKE ? LIMIT ?').all(like, like, limit);
  } catch (e) {
    return db.all('SELECT path, symbol, kind, line FROM code_symbols WHERE symbol LIKE ? OR path LIKE ? LIMIT ?', [like, like, limit]);
  }
}

function ensureSchema(db) {
  db.exec('CREATE TABLE IF NOT EXISTS code_symbols (id TEXT PRIMARY KEY, project TEXT, path TEXT, symbol TEXT, kind TEXT, line INTEGER)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_code_symbols_symbol ON code_symbols(symbol)');
}

function buildRepoMap(projectRoot, maxFiles) {
  maxFiles = maxFiles || 200;
  const files = [];
  walkFiles(projectRoot, files);
  const map = [];
  for (const f of files) {
    if (map.length >= maxFiles) break;
    const ext = path.extname(f).toLowerCase();
    const lang = EXT_LANG[ext];
    if (!lang) continue;
    let content;
    try { content = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    const syms = extractSymbols(content, lang);
    const imports = (content.match(/^\s*(?:import|from|require\()\s*[^;]+/gm) || []).slice(0, 20);
    map.push({ path: path.relative(projectRoot, f), symbols: syms.map((s) => s.name), imports });
  }
  return map;
}

module.exports = { extractSymbols, walkFiles, indexProject, searchIndex, ensureSchema, buildRepoMap };
