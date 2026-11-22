// src/mcp_everything.js
// "Everything" reference server fixture: prompts, resources, tools for MCP client testing.
const TOOLS = [
  { name: 'echo', description: 'Echo back the input', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } },
  { name: 'add', description: 'Add two numbers', inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } }, required: ['a', 'b'] } },
  { name: 'longRunningOperation', description: 'A long-running operation', inputSchema: { type: 'object', properties: { duration: { type: 'number' } } } },
];
const PROMPTS = [
  { name: 'simple_prompt', description: 'A simple prompt', arguments: [{ name: 'arg1', required: true }] },
  { name: 'complex_prompt', description: 'A complex prompt', arguments: [{ name: 'temperature', required: false }] },
];
const RESOURCES = [
  { uri: 'test://static/resource', name: 'Static Resource', mimeType: 'text/plain', description: 'A static resource' },
  { uri: 'test://dynamic/resource', name: 'Dynamic Resource', mimeType: 'application/json', description: 'A dynamic resource' },
];

function handleTool(name, args) {
  if (name === 'echo') return { content: [{ type: 'text', text: args.message || '' }] };
  if (name === 'add') return { content: [{ type: 'text', text: String((args.a || 0) + (args.b || 0)) }] };
  if (name === 'longRunningOperation') return { content: [{ type: 'text', text: 'done' }] };
  return { content: [{ type: 'text', text: 'unknown tool: ' + name }], isError: true };
}

function manifest() { return { tools: TOOLS, prompts: PROMPTS, resources: RESOURCES }; }

module.exports = { TOOLS, PROMPTS, RESOURCES, handleTool, manifest };
