// src/yaml_eval.js
// Portable YAML evals for AI agents and model harnesses.
const fs = require('fs');
const { runAgent } = require('./agent/run');

function parse(text) {
  const out = { name: '', cases: [] };
  let current = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const top = line.match(/^(\w+):\s*(.*)$/);
    if (top && !line.startsWith('-')) {
      if (top[1] === 'name') out.name = top[2].replace(/^["']|["']$/g, '');
      if (top[1] === 'cases') current = {};
      continue;
    }
    if (line.startsWith('- ')) { if (current) out.cases.push(current); current = {}; line.slice(2).trim(); }
    const kv = line.match(/^([\w]+):\s*(.*)$/);
    if (kv && current) current[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  if (current && Object.keys(current).length) out.cases.push(current);
  return out;
}
function load(file) { return parse(fs.readFileSync(file, 'utf8')); }

async function run(spec, opts) {
  opts = opts || {};
  const results = [];
  for (const c of spec.cases || []) {
    const r = await runAgent({ model: opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: c.prompt || '' }], projectRoot: process.cwd(), autoApprove: true, onEvent: () => {} });
    const out = (r.final && r.final.final) || '';
    results.push({ prompt: c.prompt, pass: !c.expected || out.toLowerCase().includes(String(c.expected).toLowerCase()), output: out.slice(0, 200) });
  }
  return { name: spec.name, passed: results.filter((r) => r.pass).length, total: results.length, results };
}

module.exports = { parse, load, run };
