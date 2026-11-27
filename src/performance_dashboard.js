// src/performance_dashboard.js
// Performance Dashboard 2.0 — unified model / tool / network latency view.
// Merges token_dashboard (model runs), profiler (tool timings), and the
// metrics store (HTTP phase timings). Local-only; no telemetry.
const tokenDashboard = require('./token_dashboard');
const profiler = require('./profiler');
const metrics = require('./metrics_store');
const httpAdvanced = require('./http_advanced');

function pct(values, p) {
  const s = (values || []).filter((v) => typeof v === 'number').slice().sort((a, b) => a - b);
  if (!s.length) return null;
  const i = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return s[i];
}

function summarize(values) {
  const s = values.filter((v) => typeof v === 'number');
  if (!s.length) return null;
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    count: s.length,
    min: s[0] != null ? Math.min(...s) : null,
    mean: +(sum / s.length).toFixed(2),
    p50: pct(s, 50),
    p95: pct(s, 95),
    p99: pct(s, 99),
    max: Math.max(...s),
  };
}

function networkSection() {
  const http = metrics.byKind('http_timing', 500);
  const phases = { dnsMs: [], tcpMs: [], tlsMs: [], serverMs: [], transferMs: [], durationMs: [] };
  for (const e of http) {
    const t = e.timings || {};
    for (const k of Object.keys(phases)) {
      const v = k === 'durationMs' ? e.durationMs : t[k];
      if (typeof v === 'number') phases[k].push(v);
    }
  }
  const out = {};
  for (const [k, v] of Object.entries(phases)) out[k] = summarize(v);
  return { samples: http.length, phases: out };
}

function toolSection() {
  const run = profiler.report();
  const tools = (run.tools || []).map((t) => ({
    name: t.name, calls: t.count, avgMs: t.avgMs, totalMs: t.totalMs,
    errors: t.errors, pctOfTotal: t.pctOfTotal,
  }));
  const load = metrics.byKind('http_load', 100);
  return {
    currentRun: { totalMs: run.totalMs, toolCalls: run.toolCalls, tokens: run.tokens, topBottleneck: run.topBottleneck },
    tools,
    loadTests: load.slice(-10).map((e) => e.result || e),
  };
}

function view() {
  const tokens = tokenDashboard.summary(200);
  return {
    version: require('../package.json').version,
    generated: new Date().toISOString(),
    model: tokens,
    tools: toolSection(),
    network: networkSection(),
    hardware: require('./hardware').recommend(),
    note: 'Unified local performance view. Enable HTTP phase capture with http_probe_timing; metrics are stored locally in data/metrics.jsonl.',
  };
}

function recordHttp(url, result) {
  return metrics.record('http_timing', { url, timings: result.timings, durationMs: result.durationMs, status: result.status });
}

function recordLoad(result) {
  return metrics.record('http_load', { url: result.url, result });
}

function tools() {
  return [
    { name: 'performance_dashboard', description: 'Unified local performance dashboard: model, tool, and network latency.', inputSchema: { type: 'object' } },
  ];
}

function dispatch(name) {
  if (name === 'performance_dashboard') return view();
  throw new Error('unknown performance_dashboard tool: ' + name);
}

module.exports = { view, recordHttp, recordLoad, summarize, tools, dispatch };
