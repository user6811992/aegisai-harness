// src/sandbox_rings.js
// 4-tier privilege rings for tool execution.
// Ring 0: system (full access), 1: trusted, 2: sandboxed, 3: untrusted (read-only).
const RINGS = { SYSTEM: 0, TRUSTED: 1, SANDBOXED: 2, UNTRUSTED: 3 };

function ringOf(toolName) {
  const destructive = ['write_file', 'delete_file', 'run_command', 'run_python'];
  const readonly = ['list_files', 'read_file', 'search_files', 'search_codebase'];
  if (destructive.includes(toolName)) return RINGS.SANDBOXED;
  if (readonly.includes(toolName)) return RINGS.TRUSTED;
  return RINGS.TRUSTED;
}

function allowed(currentRing, toolRing) {
  // a tool can run if its ring >= currentRing (lower ring = more privileged)
  return toolRing >= currentRing;
}

function describe(ring) {
  return ['system', 'trusted', 'sandboxed', 'untrusted'][ring] || 'unknown';
}

module.exports = { RINGS, ringOf, allowed, describe };
