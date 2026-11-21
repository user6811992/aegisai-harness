// src/event_stream.js
// SSE event stream: broadcast harness events to web clients.
const { bus } = require('./event_bus');

const clients = new Set();

function subscribe(res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write(': connected\n\n');
  clients.add(res);
  return () => clients.delete(res);
}
function broadcast(event, data) {
  const payload = 'event: ' + event + '\ndata: ' + JSON.stringify(data || {}) + '\n\n';
  for (const res of clients) { try { res.write(payload); } catch (e) { clients.delete(res); } }
}
bus.on('*', (e) => broadcast(e.event, e.payload));

module.exports = { subscribe, broadcast, clients };
