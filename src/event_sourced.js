// src/event_sourced.js
// Event-sourced session replay from hash-chained ledger + capsule snapshots (ringko pattern).
const ledger = require('./ledger');
const capsule = require('./capsule');

function sessionEvents(sessionId) {
  const all = ledger.list();
  return all.filter((e) => {
    try { return JSON.parse(e.payload || '{}').sessionId === sessionId; } catch (err) { return false; }
  }).map((e) => ({ seq: e.seq, event: e.event, payload: JSON.parse(e.payload || '{}'), hash: e.hash }));
}
function replay(sessionId) {
  const events = sessionEvents(sessionId);
  const caps = capsule.list().map((f) => { try { return require('fs').readFileSync(require('path').join(require('./core/config').DATA_DIR, 'capsules', f), 'utf8'); } catch (e) { return null; } })
    .filter(Boolean).map((s) => { try { return JSON.parse(s); } catch (e) { return null; } }).filter((c) => c && c.sessionId === sessionId);
  return { sessionId, events, checkpoints: caps.map((c) => ({ id: c.id, created: c.created, tokens: c.tokenEstimate })), verified: ledger.verify().ok };
}

module.exports = { sessionEvents, replay };
