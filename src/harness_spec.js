// src/harness_spec.js
// Declarative harness-as-code: define agents, tools, policies, memory in a spec file.
const fs = require('fs');

function parse(text) {
  try { return JSON.parse(text); } catch (e) {}
  const out = {};
  let section = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.endsWith(':') && !line.startsWith('-')) { section = line.slice(0, -1).trim(); out[section] = Array.isArray(out[section]) ? out[section] : {}; continue; }
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv && section) { out[section][kv[1]] = kv[2].replace(/^["']|["']$/g, ''); continue; }
    if (line.startsWith('- ') && section) { (out[section].list = out[section].list || []).push(line.slice(2).replace(/^["']|["']$/g, '')); }
  }
  return out;
}
function load(file) { return parse(fs.readFileSync(file, 'utf8')); }
function validate(spec) {
  const errors = [];
  if (!spec || typeof spec !== 'object') errors.push('spec must be an object');
  if (spec.harness && spec.harness.model) { /* ok */ }
  return { ok: errors.length === 0, errors };
}
function apply(spec) {
  const h = spec.harness || {};
  if (h.model) process.env.AEGISAI_MODEL = h.model;
  if (h.backend) process.env.BACKEND_TYPE = h.backend;
  if (h.offline !== undefined) process.env.AEGISAI_OFFLINE = String(h.offline);
  if (spec.security && spec.security.token) process.env.AEGISAI_TOKEN = spec.security.token;
  return { applied: true, model: process.env.AEGISAI_MODEL, backend: process.env.BACKEND_TYPE };
}

module.exports = { parse, load, validate, apply };
