// src/event_stream.js
// SSE event stream: broadcast harness events to web clients.
const { bus } = require('./event_bus');

const clients = new Set();

// Subscribe an SSE response. Pass the request so disconnects are cleaned up
// automatically (otherwise every closed tab leaks a listener + socket).
function subscribe(res, req) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write(': connected\n\n');
  clients.add(res);
  const cleanup = () => { clients.delete(res); try { res.end(); } catch (e) {} };
  res.on('close', cleanup);
  res.on('error', cleanup);
  if (req) { req.on('close', cleanup); req.on('aborted', cleanup); }
  return cleanup;
}
function broadcast(event, data) {
  const payload = 'event: ' + event + '\ndata: ' + JSON.stringify(data || {}) + '\n\n';
  for (const res of clients) { try { res.write(payload); } catch (e) { clients.delete(res); } }
}
bus.on('*', (e) => broadcast(e.event, e.payload));

module.exports = { subscribe, broadcast, clients };
