// src/state.js
// Conversation state persistence (load/save) for multi-turn resume.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

function filePath(sessionId) {
  return path.join(DATA_DIR, 'state', sessionId + '.json');
}

function load(sessionId) {
  const p = filePath(sessionId);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function save(sessionId, state) {
  const dir = path.join(DATA_DIR, 'state');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath(sessionId), JSON.stringify(state, null, 2));
}

function remove(sessionId) {
  const p = filePath(sessionId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function makeAccessor(sessionId) {
  return {
    load: async () => load(sessionId),
    save: async (s) => save(sessionId, s),
  };
}

module.exports = { load, save, remove, makeAccessor, filePath };
