// src/replay.js
// Deterministic replay: load a stored session and re-run the agent, returning
// the new result for comparison with the stored tool log.
const db = require('./storage/db');
const { runAgent } = require('./agent/run');
const profiles = require('./agents/profiles');

async function replaySession(sessionId, opts) {
  opts = opts || {};
  const session = db.getSession(sessionId);
  if (!session) throw new Error('session not found: ' + sessionId);
  const profile = profiles.getProfile(opts.agent || 'default');
  const messages = session.messages || [];
  // strip tool messages? keep as-is for replay
  const result = await runAgent({
    model: opts.model || profile.model || process.env.AEGISAI_MODEL || 'llama3.2:3b',
    messages: messages.filter((m) => m.role !== 'assistant' || !m.tool_calls).map((m) => ({ role: m.role, content: m.content })),
    projectRoot: opts.projectRoot || process.cwd(),
    includeCoding: profile.includeCoding,
    cleanRoom: profile.cleanRoom,
    allowedTools: profile.allowedTools,
    deniedTools: profile.deniedTools,
    sandbox: profile.sandbox,
    autoApprove: true,
  });
  return { sessionId, originalMessageCount: messages.length, replayed: result };
}

module.exports = { replaySession };
