// src/context_reset.js
// Context wipe-and-rerun: checkpoint first, then reset to the first message (neuralyzer).
const capsule = require('./capsule');

function wipeAndRerun(sessionId, messages) {
  if (!messages || !messages.length) return { ok: false, error: 'no messages' };
  const cap = capsule.write(sessionId, messages, { reason: 'pre-wipe-checkpoint' });
  const first = messages[0];
  return { ok: true, checkpoint: cap.id, resetMessages: [first], note: 'context wiped; re-run from first message' };
}

module.exports = { wipeAndRerun };
