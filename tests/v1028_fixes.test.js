const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const cert = require('../src/verification_cert');

// Issue #190: freshly issued verification certificate must pass its own hash check.
test('v1028: freshly issued certificate verifies itself', () => {
  const issued = cert.issue('smoke-self-verify', { final: 'done', toolLog: [] });
  assert.equal(issued.ok, true);
  const verified = cert.verify(issued.path);
  assert.equal(verified.ok, true);
  assert.equal(verified.contentHashMatches, true);
});

test('v1028: tampered certificate fails its hash check', () => {
  const issued = cert.issue('smoke-tamper', { final: 'done', toolLog: [] });
  const raw = JSON.parse(fs.readFileSync(issued.path, 'utf8'));
  raw.verification.verified = !raw.verification.verified;
  const tmp = path.join(os.tmpdir(), 'aegisai-tampered-cert-' + Date.now() + '.json');
  fs.writeFileSync(tmp, JSON.stringify(raw, null, 2));
  const verified = cert.verify(tmp);
  assert.equal(verified.ok, false);
  assert.equal(verified.contentHashMatches, false);
  fs.rmSync(tmp, { force: true });
});

// Issue #191: npm test must pass even when git submodules are not initialized.
test('v1028: default skills install works without Aegis submodule', () => {
  const aegisSkills = require('../src/aegis_skills');
  const available = aegisSkills.aegisAvailable();
  // The module must report a boolean availability, not throw when missing.
  assert.equal(typeof available, 'boolean');
  // Bundled default skills must always install regardless of submodule state.
  const defaultSkills = require('../src/default_skills');
  const names = defaultSkills.list().map((s) => s.name);
  assert.ok(names.includes('search-before-re'));
  assert.ok(names.includes('pr-review'));
  if (available) assert.ok(names.includes('verification-before-completion'));
});
