// src/merkle.js
// Merkle-tree root verification for the audit ledger (OpenAgentLock pattern).
const crypto = require('crypto');
const ledger = require('./ledger');

function leafHash(item) { return crypto.createHash('sha256').update(JSON.stringify(item)).digest('hex'); }
function root(items) {
  let level = (items || []).map(leafHash);
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(crypto.createHash('sha256').update(level[i] + (level[i + 1] || level[i])).digest('hex'));
    level = next;
  }
  return level[0] || crypto.createHash('sha256').update('empty').digest('hex');
}
function ledgerRoot() {
  const rows = ledger.list().map((r) => ({ seq: r.seq, event: r.event, payload: JSON.parse(r.payload || '{}') }));
  return { entries: rows.length, root: root(rows) };
}

module.exports = { leafHash, root, ledgerRoot };
