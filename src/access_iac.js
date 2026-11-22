// src/access_iac.js
// Access management IaC: declarative YAML for gateway rules (modelcontextprotocol/access).
const fs = require('fs');
const gateway = require('./gateway');

function parse(text) {
  const rules = [];
  let current = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const top = line.match(/^(\w+):\s*(.*)$/);
    if (top && !line.startsWith('-')) { current = top[1]; continue; }
    if (line.startsWith('- ') && current === 'rules') {
      const parts = line.slice(2).split(/\s+/);
      if (parts.length >= 3) rules.push({ agent: parts[0], resource: parts[1], action: parts[2] });
    }
  }
  return rules;
}
function load(file) { return parse(fs.readFileSync(file, 'utf8')); }
function apply(rules) { for (const r of rules || []) gateway.allow(r.agent, r.resource, r.action); return { applied: (rules || []).length }; }

module.exports = { parse, load, apply };
