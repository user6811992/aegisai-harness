// src/peerhive.js
// p2p pubsub over QUIC — clean-room eelbaz/peerhive idea. Contract for
// topic-based message transport between sessions. Network/opt-in only;
// disabled in offline mode. No QUIC library bundled.
const TRANSPORTS = ['quic', 'websocket', 'memory'];

function join(topic, opts) {
  opts = opts || {};
  if (!topic) return { ok: false, error: 'topic required' };
  const transport = opts.transport || 'quic';
  if (!TRANSPORTS.includes(transport)) return { ok: false, error: 'unknown transport: ' + transport };
  if (process.env.AEGISAI_OFFLINE === 'true') return { ok: false, error: 'p2p transport disabled in offline mode' };
  return { ok: true, topic, transport, peers: opts.peers || [], note: 'caller supplies the QUIC/WebSocket implementation' };
}
function publish(topic, message, opts) {
  const j = join(topic, opts);
  if (!j.ok) return j;
  return { ok: true, topic, message: String(message || '').slice(0, 4000), delivered: j.peers.length, note: 'fan-out contract only' };
}
function tools() {
  return [
    { name: 'peerhive_join', description: 'Join a p2p pubsub topic.', inputSchema: { type: 'object', properties: { topic: { type: 'string' }, transport: { type: 'string' } }, required: ['topic'] } },
    { name: 'peerhive_publish', description: 'Publish a message to a p2p topic.', inputSchema: { type: 'object', properties: { topic: { type: 'string' }, message: { type: 'string' } }, required: ['topic','message'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'peerhive_join') return join(args.topic, args);
  if (name === 'peerhive_publish') return publish(args.topic, args.message, args);
  if (name === 'peerhive_transports') return { ok: true, transports: TRANSPORTS };
  throw new Error('unknown peerhive tool: ' + name);
}
module.exports = { TRANSPORTS, join, publish, tools, dispatch };
