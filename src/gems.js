// src/gems.js
// Distill sessions into portable, redacted "Gems" that work across harnesses.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const db = require('./storage/db');
const pii = require('./pii');

function dir() { return path.join(DATA_DIR, 'gems'); }
function distill(sessionId, name) {
  const s = db.getSession(sessionId);
  if (!s) return null;
  const redacted = (s.messages || []).map((m) => {
    const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '');
    return { role: m.role, content: pii.redact(text).text };
  });
  const gem = {
    format: 'aegisai-gem-v1',
    name: name || ('gem_' + Date.now()),
    created: new Date().toISOString(),
    sourceSession: sessionId,
    messages: redacted,
    redacted: true,
  };
  fs.mkdirSync(dir(), { recursive: true });
  fs.writeFileSync(path.join(dir(), gem.name + '.json'), JSON.stringify(gem, null, 2));
  return gem;
}
function list() {
  try { return fs.readdirSync(dir()).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dir(), f), 'utf8'))); } catch (e) { return []; }
}
function importGem(obj) {
  fs.mkdirSync(dir(), { recursive: true });
  fs.writeFileSync(path.join(dir(), (obj.name || 'gem') + '.json'), JSON.stringify(obj, null, 2));
  return { ok: true, name: obj.name };
}

module.exports = { distill, list, importGem };
