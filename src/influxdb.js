// src/influxdb.js
// Opt-in InfluxDB line-protocol export for harness metrics.
// Inspired by eelbaz/lyra. Off by default — the harness stays local-only.
const fs = require('fs');
const path = require('path');

function escapeKey(s) {
  return String(s == null ? '' : s).replace(/([ ,=])/g, '\\$1');
}
function escapeValue(s) {
  return String(s).replace(/("|\\)/g, '\\$1');
}
function formatValue(v) {
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return '"' + escapeValue(v) + '"';
}

function line(measurement, tags, fields, timestampMs) {
  const tagPart = Object.entries(tags || {})
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => escapeKey(k) + '=' + escapeKey(v))
    .sort()
    .join(',');
  const fieldPart = Object.entries(fields || {})
    .filter(([, v]) => v != null)
    .map(([k, v]) => escapeKey(k) + '=' + formatValue(v))
    .join(',');
  if (!fieldPart) throw new Error('InfluxDB line requires at least one field');
  const ts = timestampMs != null ? ' ' + (typeof timestampMs === 'number' ? timestampMs * 1000000 : timestampMs) : '';
  return escapeKey(measurement) + (tagPart ? ',' + tagPart : '') + ' ' + fieldPart + ts;
}

function lines(points) {
  return (points || []).map((p) => line(p.measurement, p.tags, p.fields, p.timestampMs)).join('\n');
}

function writeLines(text, opts) {
  opts = opts || {};
  if (opts.file) {
    const p = path.resolve(opts.file);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, text.trimEnd() + '\n');
    return { ok: true, file: p };
  }
  return { ok: false, error: 'no export target configured (pass opts.file or use exportMetrics with a url)' };
}

async function exportMetrics(points, opts) {
  opts = opts || {};
  const payload = lines(points);
  if (!payload.trim()) return { ok: true, sent: 0 };
  if (opts.file) return Object.assign({ sent: points.length }, writeLines(payload, opts));
  if (opts.url) {
    const url = new URL(opts.url);
    url.searchParams.set('db', opts.database || 'harness');
    const r = await fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'text/plain' }, opts.token ? { Authorization: 'Token ' + opts.token } : {}),
      body: payload,
      signal: AbortSignal.timeout(opts.timeoutMs || 5000),
    });
    return { ok: r.ok, status: r.status, sent: points.length };
  }
  return { ok: false, error: 'configure opts.file or opts.url before exporting' };
}

function fromSpans(spans, tags) {
  return (spans || []).map((s) => ({
    measurement: 'harness_span',
    tags: Object.assign({ name: s.name }, tags || {}),
    fields: { durationMs: (s.end || s.start || 0) - (s.start || 0), status: s.status || 'ok' },
    timestampMs: s.start || Date.now(),
  }));
}

function fromLoadTest(result, tags) {
  const l = result.latency || {};
  return [{
    measurement: 'harness_http_load',
    tags: Object.assign({ url: result.url }, tags || {}),
    fields: {
      ok: result.ok || 0, failed: result.failed || 0,
      meanMs: l.mean || 0, p95Ms: l.p95 || 0, p99Ms: l.p99 || 0,
      rps: result.requestsPerSecond || 0,
    },
    timestampMs: Date.now(),
  }];
}

function tools() {
  return [
    { name: 'metrics_export_influx', description: 'Export collected metrics as InfluxDB line protocol (opt-in).', inputSchema: { type: 'object', properties: { file: { type: 'string' }, url: { type: 'string' } } } },
  ];
}

module.exports = { line, lines, writeLines, exportMetrics, fromSpans, fromLoadTest, tools };
