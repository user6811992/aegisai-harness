// src/tool_annotations.js
// MCP tool annotations: readOnlyHint, destructiveHint, idempotentHint, openWorldHint.
const ANNOTATIONS = {
  read_file: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  list_files: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  search_files: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  write_file: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  delete_file: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  run_command: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  fetch_url: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  get_time: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
};
function annotate(toolName) { return ANNOTATIONS[toolName] || { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }; }
function applyToTools(tools) { return (tools || []).map((t) => { const f = t.function || t; return Object.assign({}, t, { annotations: annotate(f.name) }); }); }

module.exports = { ANNOTATIONS, annotate, applyToTools };
