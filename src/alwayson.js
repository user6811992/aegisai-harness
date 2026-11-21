// src/alwayson.js
// Always-on layer: event inbox, timers, approvals, outbox (persistent in SQLite).
const db = require('./storage/db');

function emit(kind, payload) {
  const id = 'ev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  try {
    db.get().prepare('INSERT INTO events (id, kind, payload, status, created) VALUES (?,?,?,?,?)')
      .run(id, kind, JSON.stringify(payload || {}), 'pending', new Date().toISOString());
  } catch (e) {}
  return id;
}

function events(status) {
  try { return db.get().prepare('SELECT * FROM events WHERE status = ? ORDER BY created DESC LIMIT 100').all(status || 'pending'); } catch (e) { return []; }
}

function scheduleTimer(delayMs, payload) {
  const id = 'tm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  try {
    db.get().prepare('INSERT INTO timers (id, due, payload, status, created) VALUES (?,?,?,?,?)')
      .run(id, Date.now() + delayMs, JSON.stringify(payload || {}), 'pending', new Date().toISOString());
  } catch (e) {}
  return id;
}

function dueTimers() {
  try { return db.get().prepare('SELECT * FROM timers WHERE status = ? AND due <= ?').all('pending', Date.now()); } catch (e) { return []; }
}

function fireTimer(id) {
  try { db.get().prepare('UPDATE timers SET status = ? WHERE id = ?').run('fired', id); } catch (e) {}
}

function outbox(payload) {
  const id = 'ob_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  try {
    db.get().prepare('INSERT INTO outbox (id, payload, status, created) VALUES (?,?,?,?)')
      .run(id, JSON.stringify(payload || {}), 'pending', new Date().toISOString());
  } catch (e) {}
  return id;
}

function outboxItems(status) {
  try { return db.get().prepare('SELECT * FROM outbox WHERE status = ? ORDER BY created DESC LIMIT 100').all(status || 'pending'); } catch (e) { return []; }
}

module.exports = { emit, events, scheduleTimer, dueTimers, fireTimer, outbox, outboxItems };
