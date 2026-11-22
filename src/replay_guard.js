// src/replay_guard.js
// Replay protection + cancellation tokens for agent actions.
const seen = new Set();
const cancelled = new Set();

function fingerprint(name, args) { return name + ':' + JSON.stringify(args || {}); }
function check(name, args) {
  const fp = fingerprint(name, args);
  if (seen.has(fp)) return { ok: false, reason: 'replay detected' };
  if (cancelled.has(fp)) return { ok: false, reason: 'cancelled' };
  seen.add(fp);
  return { ok: true, token: fp };
}
function cancel(fp) { cancelled.add(fp); return { ok: true }; }
function clear() { seen.clear(); cancelled.clear(); }

module.exports = { fingerprint, check, cancel, clear };
