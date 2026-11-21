// src/read_only.js
// Formal read-only boundary: only observation tools may run.
const READ_ONLY = new Set([
  'list_files', 'read_file', 'search_files', 'search_codebase', 'get_repo_map',
  'recall_archived_context', 'get_state', 'browser_snapshot', 'browser_eval',
  'task', 'get_profile', 'list_memories', 'list_eval', 'list_sessions',
]);

function isReadOnly(name) { return READ_ONLY.has(name); }
function enforce(name, readOnly) {
  if (!readOnly) return { allowed: true };
  if (isReadOnly(name)) return { allowed: true };
  return { allowed: false, reason: 'read-only mode blocks: ' + name };
}

module.exports = { READ_ONLY, isReadOnly, enforce };
