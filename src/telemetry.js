// src/telemetry.js
// Minimal OpenTelemetry-style span export (JSON file).
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

function exportSpans(spans, outPath) {
  const p = outPath || path.join(DATA_DIR, 'otel-spans.jsonl');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const lines = (spans || []).map((s) => JSON.stringify({
    traceId: 'local',
    spanId: s.name + '_' + (s.start || 0),
    name: s.name,
    startTimeUnixNano: (s.start || 0) * 1e6,
    endTimeUnixNano: ((s.end || s.start) || 0) * 1e6,
    attributes: s.attrs || {},
    status: { code: s.status === 'error' ? 2 : 1, message: s.error || '' },
  }));
  fs.appendFileSync(p, lines.join('\n') + '\n');
  return p;
}

module.exports = { exportSpans };
