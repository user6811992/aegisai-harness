// src/verification_cert.js
// Signed, independently verifiable completion certificates for agent work.
// Combines evidence bundles, the verifier, an optional Lean check, and a
// content hash so a certificate can be re-verified later without trust.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./core/config');
const verifier = require('./verifier');
const evidence = require('./evidence_bundle');

const CERT_DIR = () => path.join(DATA_DIR, 'certificates');

function hash(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function issue(runId, run, opts) {
  opts = opts || {};
  const bundle = evidence.bundle(runId, run);
  const verification = verifier.verify(run && run.final || '', (run && run.toolLog) || []);
  const lean = opts.lean ? require('./lean_verify').verify(opts.lean.projectDir, opts.lean) : null;
  const payload = {
    type: 'aegisai-verification-certificate',
    version: 1,
    runId,
    issued: new Date().toISOString(),
    harnessVersion: require('../package.json').version,
    verification,
    evidenceBundle: bundle,
    lean: lean ? { ok: lean.ok, available: lean.available, exitCode: lean.exitCode } : null,
    claims: run && run.claims || [],
  };
  const certificateId = 'cert_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');
  const cert = Object.assign({ id: certificateId }, payload, { contentHash: hash(payload) });
  fs.mkdirSync(CERT_DIR(), { recursive: true });
  const p = path.join(CERT_DIR(), certificateId + '.json');
  fs.writeFileSync(p, JSON.stringify(cert, null, 2));
  return { ok: true, id: certificateId, path: p, verified: verification.verified, contentHash: cert.contentHash };
}

function verify(certOrPath) {
  let cert = certOrPath;
  if (typeof certOrPath === 'string') {
    try { cert = JSON.parse(fs.readFileSync(certOrPath, 'utf8')); }
    catch (e) { return { ok: false, error: 'cannot read certificate: ' + String(e.message || e) }; }
  }
  if (!cert || cert.type !== 'aegisai-verification-certificate') return { ok: false, error: 'not an AegisAi certificate' };
  const expected = hash(cert);
  return {
    ok: cert.contentHash === expected,
    id: cert.id,
    runId: cert.runId,
    issued: cert.issued,
    verified: !!(cert.verification && cert.verification.verified),
    contentHashMatches: cert.contentHash === expected,
    note: 'Hash check proves the certificate was not altered; it does not by itself prove the claims are true.',
  };
}

function list() {
  if (!fs.existsSync(CERT_DIR())) return [];
  return fs.readdirSync(CERT_DIR()).filter((f) => f.endsWith('.json')).map((f) => {
    try {
      const c = JSON.parse(fs.readFileSync(path.join(CERT_DIR(), f), 'utf8'));
      return { id: c.id, runId: c.runId, issued: c.issued, verified: c.verification && c.verification.verified };
    } catch (e) { return null; }
  }).filter(Boolean);
}

function tools() {
  return [
    { name: 'certificate_issue', description: 'Issue a signed verification certificate for an agent run.', inputSchema: { type: 'object', properties: { runId: { type: 'string' }, final: { type: 'string' } } } },
    { name: 'certificate_verify', description: 'Verify a certificate file by content hash.', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } },
  ];
}

module.exports = { issue, verify, list, hash, tools };
