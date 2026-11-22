// src/sequential_thinking.js
// Sequential thinking tool: dynamic, reflective problem-solving with thought sequences.
const THOUGHTS = [];

function think(thought, nextThoughtNeeded, thoughtNumber, totalThoughts, isRevision, revisesThought, branchFromThought, branchId, needsMoreThoughts) {
  const entry = {
    thought: String(thought || ''),
    thoughtNumber: thoughtNumber || THOUGHTS.length + 1,
    totalThoughts: totalThoughts || thoughtNumber || 1,
    nextThoughtNeeded: nextThoughtNeeded !== false,
    isRevision: !!isRevision,
    revisesThought: revisesThought || null,
    branchFromThought: branchFromThought || null,
    branchId: branchId || null,
    needsMoreThoughts: !!needsMoreThoughts,
    at: new Date().toISOString(),
  };
  THOUGHTS.push(entry);
  return { thoughtNumber: entry.thoughtNumber, totalThoughts: entry.totalThoughts, nextThoughtNeeded: entry.nextThoughtNeeded, branches: branchId ? [branchId] : [], thoughtHistoryLength: THOUGHTS.length };
}
function history() { return THOUGHTS.slice(); }
function reset() { THOUGHTS.length = 0; }

module.exports = { think, history, reset };
