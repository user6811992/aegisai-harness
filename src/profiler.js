// src/profiler.js
// Built-in performance profiler for agent runs. Tracks tool call durations,
// token usage over time, and identifies bottlenecks.
let currentRun = null;
let runStart = 0;
function startRun(label) {
  runStart = Date.now();
  currentRun = { label: label || 'run', start: runStart, tools: [], tokens: 0, iterations: 0, spans: [], toolStats: new Map() };
  return currentRun;
}

function recordTool(name, durationMs, ok) {
  if (!currentRun) return;
  const entry = { name, durationMs, ok: ok !== false, ts: Date.now() - currentRun.start };
  currentRun.spans.push(entry);
  const stat = currentRun.toolStats.get(name) || { count: 0, totalMs: 0, minMs: Infinity, maxMs: 0, errors: 0 };
  stat.count++;
  stat.totalMs += durationMs;
  stat.minMs = Math.min(stat.minMs, durationMs);
  stat.maxMs = Math.max(stat.maxMs, durationMs);
  if (ok === false) stat.errors++;
  currentRun.toolStats.set(name, stat);
  currentRun.tools.push(entry);
}

function recordTokens(n) { if (currentRun) currentRun.tokens += (n || 0); }
function recordIteration() { if (currentRun) currentRun.iterations++; }

function report() {
  const run = currentRun;
  if (!run) return { label: 'unknown', totalMs: 0, iterations: 0, tokens: 0, toolCalls: 0, uniqueTools: 0, topBottleneck: null, tools: [], spans: [] };
  const totalMs = Date.now() - run.start;
  const sorted = Array.from(run.toolStats.entries()).map(([name, s]) => ({
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
    label: run.label,
    totalMs,
    iterations: run.iterations,
    tokens: run.tokens,
    toolCalls: run.spans.length,
    uniqueTools: run.toolStats.size,
    topBottleneck,
    tools: sorted,
    spans: run.spans.slice(-50),
  };
}

function reset() {
  currentRun = null;
  runStart = 0;
}

module.exports = { startRun, recordTool, recordTokens, recordIteration, report, reset };