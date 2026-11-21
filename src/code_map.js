// src/code_map.js
// Code intelligence map: calls, data flow, control flow, class hierarchy (regex-based, local).
const fs = require('fs');
const path = require('path');
const { walkFiles } = require('./indexing/codeindex');

const EXT = /\.(js|ts|tsx|jsx|py|go|rs|java)$/i;

function analyzeFile(file, root) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
  const lines = text.split(/\r?\n/);
  const calls = [], dataFlow = [], control = [], hierarchy = [];
  lines.forEach((line, i) => {
    const callsInLine = line.match(/\b([A-Za-z_]\w*)\s*\(/g) || [];
    for (const c of callsInLine.slice(0, 5)) calls.push({ line: i + 1, name: c.replace(/\s*\($/, '') });
    const assign = line.match(/^\s*(?:const|let|var|self\.|this\.)?\s*(\w+)\s*=\s*(.+)$/);
    if (assign && assign[1].length < 40) dataFlow.push({ line: i + 1, target: assign[1], source: assign[2].slice(0, 60) });
    if (/^\s*(if|for|while|switch|try|match|case)\b/.test(line)) control.push({ line: i + 1, kind: line.trim().split(/\s|[\({]/)[0] });
    const ext = line.match(/\b(?:class|struct|interface)\s+(\w+)(?:\s*:\s*|\s+extends\s+)(\w+)/);
    if (ext) hierarchy.push({ line: i + 1, name: ext[1], parent: ext[2] });
  });
  return { path: path.relative(root, file), calls: calls.slice(0, 100), dataFlow: dataFlow.slice(0, 100), control: control.slice(0, 100), hierarchy };
}

function build(root, maxFiles) {
  root = root || process.cwd();
  const files = [];
  walkFiles(root, files);
  const map = [];
  for (const f of files) {
    if (map.length >= (maxFiles || 200)) break;
    if (!EXT.test(f)) continue;
    const a = analyzeFile(f, root);
    if (a) map.push(a);
  }
  return map;
}

module.exports = { analyzeFile, build };
