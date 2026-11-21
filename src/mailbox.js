// src/mailbox.js
// AMP-style async agent mailbox: messages instead of DAG glue.
const db = require('./storage/db');

function send(recipient, sender, subject, body) {
  const id = 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  try {
    db.get().prepare('INSERT INTO mailbox (id, recipient, sender, subject, body, status, created) VALUES (?,?,?,?,?,?,?)')
      .run(id, recipient, sender || 'user', subject || '', body || '', 'unread', new Date().toISOString());
  } catch (e) {}
  return id;
}
function inbox(recipient, status) {
  try { return db.get().prepare('SELECT * FROM mailbox WHERE recipient = ? AND status = ? ORDER BY created DESC LIMIT 100').all(recipient, status || 'unread'); } catch (e) { return []; }
}
function ack(id) {
  try { db.get().prepare("UPDATE mailbox SET status = 'read' WHERE id = ?").run(id); return true; } catch (e) { return false; }
}
function broadcast(recipients, sender, subject, body) {
  return (recipients || []).map((r) => send(r, sender, subject, body));
}

module.exports = { send, inbox, ack, broadcast };
