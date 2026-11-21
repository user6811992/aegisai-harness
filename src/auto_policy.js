// src/auto_policy.js
// Self-writing policy: learn rules from detected attacks, test before go-live.
const db = require('./storage/db');

const SAFE_SAMPLES = [
  { tool_name: 'list_files', args: { path: 'src' } },
  { tool_name: 'read_file', args: { path: 'README.md' } },
  { tool_name: 'search_codebase', args: { query: 'foo' } },
];

function rules() {
  try { return db.get().prepare('SELECT * FROM auto_rules ORDER BY created DESC').all(); } catch (e) { return []; }
}
function addRule(rule) {
  try { db.get().prepare('INSERT OR IGNORE INTO auto_rules (id, expression, source, created, active) VALUES (?,?,?,?,1)').run(rule.id, rule.expression, rule.source, new Date().toISOString()); } catch (e) {}
  return rule;
}
function test(rule, attack) {
  // rule.expression is a regex string matched against JSON of tool call
  let re;
  try { re = new RegExp(rule.expression, 'i'); } catch (e) { return { pass: false, error: 'bad regex' }; }
  const attackText = JSON.stringify(attack || {});
  const blocksAttack = re.test(attackText);
  const blocksSafe = SAFE_SAMPLES.some((s) => re.test(JSON.stringify(s)));
  return { pass: blocksAttack && !blocksSafe, blocksAttack, blocksSafe };
}
function learn(attack) {
  const text = JSON.stringify(attack || {});
  const candidates = [];
  const tools = String(text).match(/\b(write_file|delete_file|run_command|run_python|browser_eval|http_request)\b/g) || [];
  for (const t of [...new Set(tools)]) candidates.push({ id: 'ar_' + Date.now() + '_' + t, expression: '"name":"' + t + '"', source: 'attack' });
  const destructive = /rm\s+-rf|curl\s+https?:|(?:https?:\/\/)[^\s"]+/i.test(text);
  if (destructive) candidates.push({ id: 'ar_' + Date.now() + '_net', expression: 'rm -rf|curl http|https?://', source: 'attack' });
  const tested = candidates.map((c) => Object.assign({}, c, { test: test(c, attack) }));
  const approved = tested.filter((t) => t.test.pass).map((t) => addRule(t));
  return { candidates: tested, approved };
}
function check(toolName, args) {
  const payload = JSON.stringify({ name: toolName, args: args || {} });
  for (const r of rules()) {
    if (!r.active) continue;
    try { if (new RegExp(r.expression, 'i').test(payload)) return { allowed: false, rule: r.id }; } catch (e) {}
  }
  return { allowed: true };
}

module.exports = { rules, addRule, test, learn, check };
