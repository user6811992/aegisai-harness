// src/core/capabilities.js
// Capability-based tool filtering per session.
function matches(name, pattern) {
  if (pattern === '*') return true;
  if (typeof pattern === 'string' && pattern.endsWith('*')) return name.startsWith(pattern.slice(0, -1));
  return name === pattern;
}

function filterTools(tools, opts) {
  opts = opts || {};
  const allowed = opts.allowedTools;
  const denied = opts.deniedTools;
  return (tools || []).filter((t) => {
    const name = (t.function && t.function.name) || t.name;
    if (Array.isArray(denied) && denied.some((p) => matches(name, p))) return false;
    if (Array.isArray(allowed) && allowed.length > 0) {
      return allowed.some((p) => matches(name, p));
    }
    return true;
  });
}

module.exports = { filterTools, matches };
