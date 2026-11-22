// src/access_tokens.js
// Personal access tokens + scoped stream actions (deer-flow "API Access").
const crypto = require('crypto');
const db = require('./storage/db');

function mint(name, scopes) {
  const token = 'pat_' + crypto.randomBytes(24).toString('hex');
  const id = 'pat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  try { db.get().prepare('INSERT INTO access_tokens (id, token, name, scopes, created) VALUES (?,?,?,?,?)').run(id, token, name || '', JSON.stringify(scopes || ['read']), new Date().toISOString()); } catch (e) {}
  return { id, token, name, scopes: scopes || ['read'] };
}
function verify(token) {
  try { const r = db.get().prepare('SELECT * FROM access_tokens WHERE token = ?').get(token); return r ? { ok: true, scopes: JSON.parse(r.scopes || '[]'), name: r.name } : { ok: false }; } catch (e) { return { ok: false }; }
}
function list() { try { return db.get().prepare('SELECT id, name, scopes, created FROM access_tokens').all().map((r) => Object.assign({}, r, { scopes: JSON.parse(r.scopes || '[]') })); } catch (e) { return []; } }
function revoke(id) { try { db.get().prepare('DELETE FROM access_tokens WHERE id = ?').run(id); return { ok: true }; } catch (e) { return { ok: false }; } }
function hasScope(token, scope) { const v = verify(token); return v.ok && (v.scopes.includes('*') || v.scopes.includes(scope)); }

module.exports = { mint, verify, list, revoke, hasScope };
