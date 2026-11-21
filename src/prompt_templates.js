// src/prompt_templates.js
// Reusable prompt snippets with {{variable}} substitution.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

const BUILTIN = {
  code_review: 'Review this code for correctness, security, and clarity:\n\n{{code}}',
  explain: 'Explain {{topic}} in simple terms, with an example.',
  commit: 'Write a concise git commit message for these changes:\n\n{{diff}}',
  test: 'Write unit tests for the following code:\n\n{{code}}',
};
function dir() { return path.join(DATA_DIR, 'prompt-templates'); }
function list() {
  const out = Object.assign({}, BUILTIN);
  try { for (const f of fs.readdirSync(dir()).filter((f) => f.endsWith('.txt'))) out[f.slice(0, -4)] = fs.readFileSync(path.join(dir(), f), 'utf8'); } catch (e) {}
  return out;
}
function render(name, vars) {
  const t = list()[name];
  if (!t) return null;
  return t.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars && vars[k]) || '');
}
function save(name, text) {
  fs.mkdirSync(dir(), { recursive: true });
  fs.writeFileSync(path.join(dir(), name + '.txt'), text);
  return name;
}

module.exports = { BUILTIN, list, render, save };
