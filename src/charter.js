// src/charter.js
// Governance charter: machine-readable project rules governing HOW agents work.
const fs = require('fs');
const path = require('path');

function parse(text) {
  const charter = { protected_paths: [], require_approval: [], forbidden_tools: [], quality_gates: [] };
  let section = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.endsWith(':') && !line.startsWith('-')) {
      section = line.slice(0, -1).trim();
      continue;
    }
    if (line.startsWith('- ') && section && charter[section]) charter[section].push(line.slice(2).trim().replace(/^["']|["']$/g, ''));
  }
  return charter;
}

function load(root) {
  root = path.resolve(root || process.cwd());
  for (const name of ['.aegisai/charter.yaml', 'CHARTER.md']) {
    const p = path.join(root, name);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return Object.assign({ path: p }, parse(fs.readFileSync(p, 'utf8')));
  }
  return null;
}

function toPolicy(charter) {
  if (!charter) return { rules: [], defaults: { action: 'allow' } };
  const rules = [];
  for (const t of charter.forbidden_tools || []) rules.push({ name: 'charter_forbid_' + t, condition: { field: 'tool_name', operator: 'equals', value: t }, action: 'deny', priority: 100 });
  return { rules, defaults: { action: 'allow' } };
}

function enforce(charter, toolName, args) {
  if (!charter) return { allowed: true };
  if ((charter.forbidden_tools || []).includes(toolName)) return { allowed: false, reason: 'charter forbids tool: ' + toolName };
  const paths = [args && args.path, args && args.file_path, args && args.filePath].filter(Boolean).map(String);
  for (const pat of charter.protected_paths || []) {
    if (paths.some((p) => p === pat || p.startsWith(pat.replace(/\/$/, '') + '/'))) return { allowed: false, reason: 'protected path: ' + pat };
  }
  const approval = (charter.require_approval || []).includes(toolName);
  const gates = charter.quality_gates || [];
  return { allowed: true, approval, gates };
}

module.exports = { parse, load, toPolicy, enforce };
