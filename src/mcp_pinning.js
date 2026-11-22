// src/mcp_pinning.js
// MCP server pinning: hash server config, detect drift (aiguard pattern).
const crypto = require('crypto');
const db = require('./storage/db');

function hash(config) { return crypto.createHash('sha256').update(JSON.stringify(config || {})).digest('hex'); }
function pin(name, config) {
  const h = hash(config);
  try { db.get().prepare('INSERT OR REPLACE INTO mcp_pins (name, hash, created) VALUES (?,?,?)').run(name, h, new Date().toISOString()); } catch (e) {}
  return { name, hash: h };
}
function verify(name, config) {
  let row = null;
  try { row = db.get().prepare('SELECT hash FROM mcp_pins WHERE name = ?').get(name); } catch (e) {}
  const current = hash(config);
  return { ok: !!row && row.hash === current, pinned: row ? row.hash : null, current, drift: !!row && row.hash !== current };
}
function list() { try { return db.get().prepare('SELECT * FROM mcp_pins').all(); } catch (e) { return []; } }

module.exports = { hash, pin, verify, list };
