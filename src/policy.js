// src/policy.js
// Deterministic policy engine (YAML subset). Evaluates tool calls before execution.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

function parseYaml(text) {
  // reuse minimal TOML-ish parser (key: value, lists)
  const result = { rules: [] };
  let current = null;
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('- ')) {
      // new rule item
      current = {};
      if (!result.rules) result.rules = [];
      result.rules.push(current);
      line = line.slice(2).trim();
    }
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv && current) {
      let val = kv[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (val === 'true') val = true;
      if (val === 'false') val = false;
      if (/^-?\d+$/.test(val)) val = parseInt(val, 10);
      current[kv[1]] = val;
    }
  }
  return result;
}

function loadPolicies(filePath) {
  const p = filePath || path.join(DATA_DIR, 'policies.yaml');
  if (!fs.existsSync(p)) return { rules: [], defaults: { action: 'allow' } };
  return parseYaml(fs.readFileSync(p, 'utf8'));
}

function matchCondition(cond, ctx) {
  if (!cond) return true;
  const field = cond.field || 'tool_name';
  const op = cond.operator || 'equals';
  const val = ctx[field];
  const target = cond.value;
  if (op === 'equals') return val === target;
  if (op === 'in') return Array.isArray(target) && target.includes(val);
  if (op === 'contains') return String(val || '').includes(String(target));
  if (op === 'matches') return new RegExp(target).test(String(val || ''));
  return false;
}

function evaluate(policy, ctx) {
  policy = policy || { rules: [], defaults: { action: 'allow' } };
  const rules = (policy.rules || []).slice().sort((a, b) => (b.priority || 0) - (a.priority || 0));
  for (const r of rules) {
    if (matchCondition(r.condition || r, ctx)) {
      return { allowed: (r.action || 'allow') === 'allow', rule: r.name || r.rule, action: r.action || 'allow' };
    }
  }
  const def = (policy.defaults && policy.defaults.action) || 'allow';
  return { allowed: def === 'allow', rule: 'default', action: def };
}

module.exports = { parseYaml, loadPolicies, matchCondition, evaluate };
