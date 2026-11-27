// src/embedding_registry.js
// Embedding client registration — clean-room asg017/sqlite-rembed idea.
// Register embedding providers by name (like a virtual table), each with an
// endpoint/model; local hash embedding is always available offline.
const { embed } = require('./semantic_tools');
const CLIENTS = {
  local: { provider: 'local', model: 'hash-64', offline: true },
  llamafile: { provider: 'llamafile', endpoint: 'http://127.0.0.1:8080/embedding', offline: false },
  ollama: { provider: 'ollama', endpoint: 'http://127.0.0.1:11434/api/embed', offline: false },
  openai: { provider: 'openai', endpoint: 'https://api.openai.com/v1/embeddings', keyEnv: 'OPENAI_API_KEY', offline: false },
  nomic: { provider: 'nomic', endpoint: 'https://api-atlas.nomic.ai/v1/embedding/text', keyEnv: 'NOMIC_API_KEY', offline: false },
  cohere: { provider: 'cohere', endpoint: 'https://api.cohere.com/v2/embed', keyEnv: 'CO_API_KEY', offline: false },
};
function register(name, def) {
  if (!name || !def || !def.provider) return { ok: false, error: 'name and provider required' };
  CLIENTS[name] = Object.assign({}, def, { registered: new Date().toISOString() });
  return { ok: true, name, client: CLIENTS[name] };
}
function list() { return Object.entries(CLIENTS).map(([name,c]) => ({ name, ...c })); }
function vector(text, name) {
  const c = CLIENTS[name] || CLIENTS.local;
  if (c.offline || !c.endpoint) return { ok: true, client: name, vector: embed(String(text||'')), offline: true };
  return { ok: false, error: `remote client ${name} requires a fetch call by the caller`, endpoint: c.endpoint, keyEnv: c.keyEnv };
}
function tools() {
  return [
    { name: 'embed_register', description: 'Register an embedding client by name.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, provider: { type: 'string' }, endpoint: { type: 'string' } }, required: ['name','provider'] } },
    { name: 'embed_clients', description: 'List registered embedding clients.', inputSchema: { type: 'object' } },
    { name: 'embed_vector', description: 'Compute an embedding with a registered client.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, client: { type: 'string' } }, required: ['text'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'embed_register') return register(args.name, args);
  if (name === 'embed_clients') return { ok: true, clients: list() };
  if (name === 'embed_vector') return vector(args.text, args.client);
  throw new Error('unknown embedding_registry tool: ' + name);
}
module.exports = { CLIENTS, register, list, vector, tools, dispatch };
