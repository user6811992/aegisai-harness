// src/profiler.js
// Built-in performance profiler for agent runs. Tracks tool call durations,
// token usage over time, and identifies bottlenecks.
const spans = [];
const toolStats = new Map(); // name -> { count, totalMs, minMs, maxMs }
let runStart = 0;
let currentRun = null;

function startRun(label) {
  runStart = Date.now();
  currentRun = { label: label || 'run', start: runStart, tools: [], tokens: 0, iterations: 0 };
  spans.length = 0;
  toolStats.clear();
  return currentRun;
}

function recordTool(name, durationMs, ok) {
  const entry = { name, durationMs, ok: ok !== false, ts: Date.now() - runStart };
  spans.push(entry);
  const stat = toolStats.get(name) || { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, errors: 0 };
  stat.count++;
  stat.totalMs += durationMs;
  stat.minMs = Math.min(stat.minMs, durationMs);
  stat.maxMs = Math.max(stat.maxMs, durationMs);
  if (ok === false) stat.errors++;
  toolStats.set(name, stat);
  if (currentRun) currentRun.tools.push(entry);
}

function recordTokens(n) { if (currentRun) currentRun.tokens += (n || 0); }
function recordIteration() { if (currentRun) currentRun.iterations++; }

function report() {
  const totalMs = Date.now() - runStart;
  const sorted = Array.from(toolStats.entries()).map(([name, s]) => ({
    name,
    count: s.count,
    totalMs: s.totalMs,
    avgMs: Math.round(s.totalMs / s.count),
    minMs: s.minMs === Infinity ? 0 : s.minMs,
    maxMs: s.maxMs,
    errors: s.errors,
    pctOfTotal: totalMs > 0 ? Math.round((s.totalMs / totalMs) * 100) : 0,
  })).sort((a, b) => b.totalMs - a.totalMs);

  const topBottleneck = sorted.length > 0 ? sorted[0] : null;
  return {
    label: currentRun ? currentRun.label : 'unknown',
    totalMs,
    iterations: currentRun ? currentRun.iterations : 0,
    tokens: currentRun ? currentRun.tokens : 0,
    toolCalls: spans.length,
    uniqueTools: toolStats.size,
    topBottleneck,
    tools: sorted,
    spans: spans.slice(-50),
  };
}

function reset() {
  spans.length = 0;
  toolStats.clear();
  currentRun = null;
  runStart = 0;
}

module.exports = { startRun, recordTool, recordTokens, recordIteration, report, reset };