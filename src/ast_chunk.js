// src/ast_chunk.js
// AST-aware RAG chunking + optional watch mode.
const fs = require('fs');
const path = require('path');
const codeMap = require('./code_map');

function chunkFile(file, root) {
  const a = codeMap.analyzeFile(file, root);
  if (!a) return [];
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return []; }
  const lines = text.split(/\r?\n/);
  const chunks = [];
  const anchors = [...a.calls, ...a.control, ...a.hierarchy].sort((x, y) => x.line - y.line);
  let start = 0;
  for (const anchor of anchors) {
    const end = Math.min(lines.length, anchor.line + 12);
    if (end - start >= 8) { chunks.push({ file: a.path, start: start + 1, end, text: lines.slice(start, end).join('\n').slice(0, 3000) }); start = anchor.line - 1; }
  }
  if (start < lines.length) chunks.push({ file: a.path, start: start + 1, end: lines.length, text: lines.slice(start).join('\n').slice(0, 3000) });
  return chunks;
}
function chunkProject(root, maxFiles) {
  const map = codeMap.build(root, maxFiles || 100);
  return map.flatMap((f) => chunkFile(path.join(root, f.path), root));
}
function watch(root, onChange) {
  const watcher = fs.watch(root, { recursive: true }, (event, filename) => {
    if (filename && /\.(js|ts|py|go|rs)$/.test(filename)) onChange(event, filename);
  });
  return { close: () => watcher.close() };
}

module.exports = { chunkFile, chunkProject, watch };
