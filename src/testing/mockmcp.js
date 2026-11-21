// src/testing/mockmcp.js
// Minimal stdio MCP server for testing. Exposes get_state/set_state with in-memory state.
const readline = require('readline');
const state = { value: null, history: [] };

function send(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  line = line.trim();
  if (!line) return;
  let msg;
  try { msg = JSON.parse(line); } catch (e) { return; }
  if (msg.method === 'initialize') {
    send({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'mockmcp', version: '1.0.0' } } });
  } else if (msg.method === 'notifications/initialized') {
    // no response
  } else if (msg.method === 'tools/list') {
    send({ jsonrpc: '2.0', id: msg.id, result: { tools: [
      { name: 'get_state', description: 'Get current state', inputSchema: { type: 'object', properties: {} } },
      { name: 'set_state', description: 'Set state value', inputSchema: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] } },
    ] } });
  } else if (msg.method === 'tools/call') {
    const name = msg.params && msg.params.name;
    const args = (msg.params && msg.params.arguments) || {};
    let result;
    if (name === 'get_state') {
      result = { content: [{ type: 'text', text: JSON.stringify(state) }] };
    } else if (name === 'set_state') {
      state.value = args.value;
      state.history.push(args.value);
      result = { content: [{ type: 'text', text: 'ok' }] };
    } else {
      result = { content: [{ type: 'text', text: 'unknown tool' }], isError: true };
    }
    send({ jsonrpc: '2.0', id: msg.id, result });
  }
});
