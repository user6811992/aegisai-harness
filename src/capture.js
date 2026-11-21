// src/capture.js
// Multimodal context capture (screen/audio) — local-only, read-only.
// Records episodes to SQLite; actual OCR/ASR delegated to external helpers.
const db = require('./storage/db');

function recordEpisode(type, content, app) {
  const id = 'ep_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  try {
    db.get().prepare('INSERT INTO context_episodes (id, type, content, app, created) VALUES (?,?,?,?,?)')
      .run(id, type, content, app || '', new Date().toISOString());
  } catch (e) {}
  return id;
}

function listEpisodes(limit) {
  try {
    return db.get().prepare('SELECT * FROM context_episodes ORDER BY created DESC LIMIT ?').all(limit || 50);
  } catch (e) { return []; }
}

module.exports = { recordEpisode, listEpisodes };
