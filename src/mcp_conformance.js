// src/mcp_conformance.js
// Validate an MCP server (or our own) against the spec: tools/resources/prompts shape.
function validateTool(t) {
  const issues = [];
  if (!t.name || typeof t.name !== 'string') issues.push('tool missing name');
  if (!t.inputSchema || t.inputSchema.type !== 'object') issues.push('tool inputSchema must be object schema');
  if (t.description && typeof t.description !== 'string') issues.push('tool description must be string');
  return { ok: issues.length === 0, issues };
}
function validateResource(r) {
  const issues = [];
  if (!r.uri || typeof r.uri !== 'string') issues.push('resource missing uri');
  if (!r.name || typeof r.name !== 'string') issues.push('resource missing name');
  return { ok: issues.length === 0, issues };
}
function validatePrompt(p) {
  const issues = [];
  if (!p.name || typeof p.name !== 'string') issues.push('prompt missing name');
  if (p.arguments && !Array.isArray(p.arguments)) issues.push('prompt arguments must be array');
  return { ok: issues.length === 0, issues };
}
function run(manifest) {
  const tools = (manifest.tools || []).map((t) => ({ item: t.name, ...validateTool(t) }));
  const resources = (manifest.resources || []).map((r) => ({ item: r.uri || r.name, ...validateResource(r) }));
  const prompts = (manifest.prompts || []).map((p) => ({ item: p.name, ...validatePrompt(p) }));
  const all = tools.concat(resources).concat(prompts);
  return { ok: all.every((x) => x.ok), tools, resources, prompts, summary: all.length + ' items, ' + all.filter((x) => !x.ok).length + ' issues' };
}

module.exports = { validateTool, validateResource, validatePrompt, run };
