// src/stream_actions.js
// PAT-gated streaming actions: token-scoped SSE stream of agent output.
const accessTokens = require('./access_tokens');
const { runAgent } = require('./agent/run');

async function stream(token, prompt, res, opts) {
  opts = opts || {};
  const v = accessTokens.verify(token);
  if (!v.ok) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'invalid token' })); return; }
  if (!v.scopes.includes('stream') && !v.scopes.includes('*') && !v.scopes.includes('execute')) { res.writeHead(403); res.end(JSON.stringify({ error: 'missing scope' })); return; }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  try {
    await runAgent({ model: opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: prompt }], projectRoot: opts.projectRoot || process.cwd(), autoApprove: true, onEvent: (e) => { if (e.type === 'token') res.write('data: ' + JSON.stringify({ type: 'token', content: e.content }) + '\n\n'); } });
    res.write('event: done\ndata: {}\n\n');
  } catch (e) { res.write('event: error\ndata: ' + JSON.stringify({ error: String(e.message || e) }) + '\n\n'); }
  res.end();
}

module.exports = { stream };
