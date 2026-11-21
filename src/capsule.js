// src/capsule.js
// Verified context capsules: checkpoint at a threshold, clear, resume with persistent memory.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const tokenizer = require('./tokenizer');
const ledger = require('./ledger');

function dir() { return path.join(DATA_DIR, 'capsules'); }
function list() {
  try { return fs.readdirSync(dir()).filter((f) => f.endsWith('.json')); } catch (e) { return []; }
}
function write(sessionId, messages, meta) {
  const id = 'cap_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const p = dir();
  fs.mkdirSync(p, { recursive: true });
  const rec = { id, sessionId: sessionId || 'default', created: new Date().toISOString(), tokenEstimate: tokenizer.countMessages(messages), meta: meta || {}, messages };
  fs.writeFileSync(path.join(p, id + '.json'), JSON.stringify(rec, null, 2));
  try { ledger.append('capsule_write', { id, sessionId: rec.sessionId, tokens: rec.tokenEstimate }); } catch (e) {}
  return rec;
}
function read(id) {
  try { return JSON.parse(fs.readFileSync(path.join(dir(), id + '.json'), 'utf8')); } catch (e) { return null; }
}
function latest(sessionId) {
  const rows = list().map((f) => { try { return JSON.parse(fs.readFileSync(path.join(dir(), f), 'utf8')); } catch (e) { return null; } }).filter(Boolean).filter((c) => c.sessionId === (sessionId || 'default'));
  return rows.sort((a, b) => b.created.localeCompare(a.created))[0] || null;
}
function shouldCompact(messages, ratio, contextSize) {
  const tokens = tokenizer.countMessages(messages || []);
  return tokens >= (contextSize || 8192) * (ratio || 0.8);
}

module.exports = { write, read, latest, list, shouldCompact };
