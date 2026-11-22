// src/proof_of_work.js
// Proof-of-work artifact: CI status + PR review + complexity analysis + walkthrough (symphony).
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

function create(runId, parts) {
  parts = parts || {};
  const artifact = {
    runId: runId || ('pow_' + Date.now()),
    created: new Date().toISOString(),
    ci: parts.ci || { status: 'unknown' },
    prReview: parts.prReview || null,
    complexity: parts.complexity || null,
    walkthrough: parts.walkthrough || '',
    verdict: parts.ci && parts.ci.status === 'green' ? 'accepted' : 'pending',
  };
  const dir = path.join(DATA_DIR, 'proof-of-work');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, artifact.runId + '.json'), JSON.stringify(artifact, null, 2));
  return artifact;
}
function list() {
  const dir = path.join(DATA_DIR, 'proof-of-work');
  try { return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))); } catch (e) { return []; }
}

module.exports = { create, list };
