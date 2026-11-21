// src/self_improve.js
// Self-improvement loop: propose → eval → approve → ship.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const counterfactual = require('./counterfactual');
const waste = require('./waste');
const optimizer = require('./optimizer');

const FILE = () => path.join(DATA_DIR, 'self-improvements.jsonl');

function load() {
  const p = FILE();
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
}
function propose() {
  const items = [];
  const diag = counterfactual.diagnose();
  for (const d of diag.diagnoses) {
    if (d.param) items.push({ kind: 'config', param: d.param, value: d.value, reason: d.counterfactual, status: 'proposed' });
  }
  const w = waste.detect([]);
  if (w.flags.length) items.push({ kind: 'guardrail', reason: 'waste flags: ' + w.flags.map((f) => f.type).join(', '), status: 'proposed' });
  for (const i of items) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(FILE(), JSON.stringify(Object.assign({ id: 'si_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), created: new Date().toISOString() }, i)) + '\n');
  }
  return items;
}
function evaluate(id) {
  const item = load().find((x) => x.id === id);
  if (!item) return null;
  // cheap eval: does the proposed config improve harness score inputs?
  const diag = counterfactual.diagnose();
  const fit = diag.diagnoses.some((d) => d.param === item.param);
  return { id, fit: item.kind === 'config' ? fit : true, reason: item.reason };
}
function approve(id) {
  const rows = load();
  const item = rows.find((x) => x.id === id);
  if (!item) return null;
  item.status = 'approved';
  fs.writeFileSync(FILE(), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return item;
}
function ship(id) {
  const rows = load();
  const item = rows.find((x) => x.id === id);
  if (!item) return null;
  if (item.kind === 'config' && item.param) optimizer.apply([{ param: item.param, value: item.value, reason: item.reason }]);
  item.status = 'shipped';
  fs.writeFileSync(FILE(), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return item;
}

module.exports = { propose, evaluate, approve, ship, load };
