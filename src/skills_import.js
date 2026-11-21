// src/skills_import.js
// Import SKILL.md files into the skills store.
const fs = require('fs');
const path = require('path');
const db = require('./storage/db');

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2] };
}

function importSkill(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const { meta, body } = parseFrontmatter(text);
  const name = meta.name || path.basename(filePath, path.extname(filePath));
  const description = meta.description || '';
  db.get().prepare('INSERT OR REPLACE INTO skills (name, description, code, created, updated) VALUES (?,?,?,?,?)')
    .run(name, description, body, new Date().toISOString(), new Date().toISOString());
  return { name, description };
}

module.exports = { parseFrontmatter, importSkill };
