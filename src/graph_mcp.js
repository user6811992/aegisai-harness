// src/graph_mcp.js
// Knowledge graph memory exposed via MCP (modelcontextprotocol/servers "Memory").
const graphMemory = require('./graph_memory');

function tools() {
  return [
    { name: 'create_entities', description: 'Create entities in the knowledge graph', inputSchema: { type: 'object', properties: { entities: { type: 'array' } } } },
    { name: 'create_relations', description: 'Create relations between entities', inputSchema: { type: 'object', properties: { relations: { type: 'array' } } } },
    { name: 'add_observations', description: 'Add observations to entities', inputSchema: { type: 'object', properties: { observations: { type: 'array' } } } },
    { name: 'search_nodes', description: 'Search nodes in the knowledge graph', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } },
    { name: 'read_graph', description: 'Read the entire knowledge graph', inputSchema: { type: 'object', properties: {} } },
  ];
}
function handle(name, args) {
  args = args || {};
  if (name === 'create_entities') { for (const e of args.entities || []) graphMemory.addNode(e.name || e, e.entityType || 'entity'); return { content: [{ type: 'text', text: 'created ' + (args.entities || []).length }] }; }
  if (name === 'create_relations') { for (const r of args.relations || []) graphMemory.addEdge(r.from || r.source, r.to || r.target, r.relationType || 'related'); return { content: [{ type: 'text', text: 'created ' + (args.relations || []).length }] }; }
  if (name === 'add_observations') { for (const o of args.observations || []) graphMemory.observe(o.contents || o.text || '', []); return { content: [{ type: 'text', text: 'added ' + (args.observations || []).length }] }; }
  if (name === 'search_nodes') { const r = graphMemory.recall(args.query || '', 2); return { content: [{ type: 'text', text: JSON.stringify(r) }] }; }
  if (name === 'read_graph') { return { content: [{ type: 'text', text: JSON.stringify(graphMemory.graph()) }] }; }
  return { content: [{ type: 'text', text: 'unknown tool: ' + name }], isError: true };
}

module.exports = { tools, handle };
