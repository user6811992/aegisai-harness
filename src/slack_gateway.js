// src/slack_gateway.js
// Slack-native gateway adapter: mention → session → reply (opencomputer "Calvin" pattern).
const { runAgent } = require('./agent/run');

const sessions = new Map();

function parseEvent(event) {
  const text = event.text || '';
  const mention = text.match(/<@[\w]+>\s*(.*)/);
  return { channel: event.channel, user: event.user, text: mention ? mention[1] : text, ts: event.ts };
}
function sessionKey(msg) { return msg.channel + ':' + msg.user; }

async function handle(event, opts) {
  opts = opts || {};
  const msg = parseEvent(event);
  const key = sessionKey(msg);
  const history = sessions.get(key) || [];
  const r = await runAgent({ model: opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: history.concat([{ role: 'user', content: msg.text }]), projectRoot: opts.projectRoot || process.cwd(), autoApprove: false, onEvent: () => {} });
  const final = (r.final && r.final.final) || '';
  sessions.set(key, history.concat([{ role: 'user', content: msg.text }, { role: 'assistant', content: final }]));
  return { channel: msg.channel, user: msg.user, text: final, threadTs: msg.ts };
}
function reply(client, result) {
  if (!client || !client.chat || typeof client.chat.postMessage !== 'function') return { ok: false, note: 'no Slack client configured (mock mode)' };
  return client.chat.postMessage({ channel: result.channel, thread_ts: result.threadTs, text: result.text });
}
function status() { return { configured: !!(process.env.SLACK_BOT_TOKEN), sessions: sessions.size }; }

module.exports = { parseEvent, handle, reply, status };
