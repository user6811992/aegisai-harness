// src/contracts.js
// Contract-driven call-chain baselines + regression diff.
const db = require('./storage/db');

function snapshot(name, toolLog) {
  const chain = (toolLog || []).map((t) => t.name);
  try {
    db.get().prepare('INSERT OR REPLACE INTO contracts (name, created, chain) VALUES (?,?,?)')
      .run(name, new Date().toISOString(), JSON.stringify(chain));
  } catch (e) {}
  return { name, chain };
}

function get(name) {
  try {
    const r = db.get().prepare('SELECT * FROM contracts WHERE name = ?').get(name);
    return r ? { name: r.name, chain: JSON.parse(r.chain || '[]') } : null;
  } catch (e) { return null; }
}

function list() {
  try { return db.get().prepare('SELECT name, created, chain FROM contracts ORDER BY created DESC LIMIT 50').all().map((r) => ({ name: r.name, created: r.created, chain: JSON.parse(r.chain || '[]') })); } catch (e) { return []; }
}

function check(name, toolLog) {
  const base = get(name);
  if (!base) return { ok: false, error: 'no baseline: ' + name };
  const cur = (toolLog || []).map((t) => t.name);
  const missing = base.chain.filter((n, i) => cur.indexOf(n) < i);
  const added = cur.filter((n) => !base.chain.includes(n));
  const reordered = cur.join('>') !== base.chain.join('>') && missing.length === 0 && added.length === 0;
  return { ok: missing.length === 0 && added.length === 0 && !reordered, baseline: base.chain, current: cur, missing, added, reordered };
}

module.exports = { snapshot, get, list, check };
