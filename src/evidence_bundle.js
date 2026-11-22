// src/evidence_bundle.js
// Per-run evidence bundles: collect ledger/verification/diffs into one auditable artifact (yatra pattern).
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const ledger = require('./ledger');
const verifier = require('./verifier');

function bundle(runId, run) {
  run = run || {};
  const v = verifier.verify(run.final || '', run.toolLog || []);
  const artifacts = {
    runId, created: new Date().toISOString(),
    final: String(run.final || '').slice(0, 2000),
    verification: v,
    toolLog: (run.toolLog || []).map((t) => ({ name: t.name, args: t.args, preview: String(t.resultPreview || '').slice(0, 200) })),
    ledger: ledger.list().slice(-50).map((e) => ({ seq: e.seq, event: e.event })),
  };
  fs.mkdirSync(path.join(DATA_DIR, 'evidence'), { recursive: true });
  const p = path.join(DATA_DIR, 'evidence', runId + '.json');
  fs.writeFileSync(p, JSON.stringify(artifacts, null, 2));
  return { runId, path: p, verified: v.verified };
}

module.exports = { bundle };
