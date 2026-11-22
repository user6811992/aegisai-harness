// src/ws_bridge.js
// Outbound-only WebSocket bridge: forward harness events to a remote gateway (opencomputer pattern).
const { bus } = require('./event_bus');

let socket = null;
let forwarded = 0;

async function connect(url) {
  socket = new WebSocket(url || process.env.HARNESS_WS_URL);
  await new Promise((res, rej) => { socket.onopen = res; socket.onerror = rej; });
  socket.onmessage = (e) => {
    try {
      const m = JSON.parse(e.data);
      if (m.type === 'prompt' && m.text) require('./event_bus').bus.emit('remote_prompt', m);
    } catch (err) {}
  };
  return { ok: true };
}
function forward(event, payload) {
  if (!socket || socket.readyState !== 1) return { ok: false, note: 'not connected' };
  try { socket.send(JSON.stringify({ type: 'event', event, payload })); forwarded += 1; return { ok: true, forwarded }; }
  catch (e) { return { ok: false, error: String(e.message || e) }; }
}
bus.on('*', (e) => forward(e.event, e.payload));
function status() { return { connected: !!socket && socket.readyState === 1, forwarded }; }

module.exports = { connect, forward, status };
