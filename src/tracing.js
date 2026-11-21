// src/tracing.js
// Lightweight tracer: records spans with timing and status.
const { performance } = require('perf_hooks');

class Tracer {
  constructor(runId) {
    this.runId = runId || ('run_' + Date.now());
    this.spans = [];
    this.started = new Date().toISOString();
    this._stack = [];
  }
  startSpan(name, attrs) {
    const span = { name, attrs: attrs || {}, start: performance.now(), status: 'ok' };
    this._stack.push(span);
    return span;
  }
  endSpan(span, extra) {
    span.end = performance.now();
    span.durationMs = Math.round(span.end - span.start);
    if (extra) Object.assign(span, extra);
    this.spans.push(span);
    const idx = this._stack.indexOf(span);
    if (idx >= 0) this._stack.splice(idx, 1);
    return span;
  }
  failSpan(span, err) {
    span.status = 'error';
    span.error = String((err && (err.message || err)) || err);
    return this.endSpan(span);
  }
  async wrap(name, attrs, fn) {
    const span = this.startSpan(name, attrs);
    try {
      const r = await fn();
      this.endSpan(span);
      return r;
    } catch (e) {
      this.failSpan(span, e);
      throw e;
    }
  }
  toJSON() {
    return { runId: this.runId, started: this.started, ended: new Date().toISOString(), spans: this.spans };
  }
  persist(db) {
    try {
      db.prepare('INSERT INTO traces (id, started, ended, data) VALUES (?,?,?,?)')
        .run(this.runId, this.started, new Date().toISOString(), JSON.stringify(this.toJSON()));
    } catch (e) {
      try { db.run('INSERT INTO traces (id, started, ended, data) VALUES (?,?,?,?)', [this.runId, this.started, new Date().toISOString(), JSON.stringify(this.toJSON())]); } catch (e2) {}
    }
  }
  exportOtel(outPath) {
    try { require('./telemetry').exportSpans(this.spans, outPath); } catch (e) {}
  }
}

module.exports = { Tracer };
