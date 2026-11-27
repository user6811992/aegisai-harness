const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const curator = require('../src/vault_curator');
const slop = require('../src/slop_scan');

function makeVault() {
  const root = path.join(os.tmpdir(), 'aegisai-curator-' + Date.now());
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, '2024-01-15 Daily.md'), '# Authentication uses short-lived tokens\n\nDetails about token refresh and expiry windows.');
  fs.writeFileSync(path.join(root, 'TokenRefresh.md'), '# Token refresh flow\n\nAuthentication uses short-lived tokens and refresh windows.');
  fs.writeFileSync(path.join(root, 'Old note.md'), '# Old orphan note\n\nSomething long ago.');
  fs.writeFileSync(path.join(root, 'MOC - Index.md'), '# Map of content\n\nIndex of notes.');
  // Make old note old
  const old = path.join(root, 'Old note.md');
  const t = new Date(Date.now() - 60 * 86400000);
  fs.utimesSync(old, t, t);
  return root;
}

// ---- curator ----

test('curator: shapeOfName detects timestamp and category', () => {
  assert.ok(curator.shapeOfName('2024-01-15 Daily.md').includes('timestamp'));
  assert.ok(curator.shapeOfName('Meeting notes 12-03.md').includes('category'));
  assert.deepEqual(curator.shapeOfName('Authentication.md'), []);
});

test('curator: claimProposal derives a claim-shaped title', () => {
  const r = curator.claimProposal('2024-01-15 Daily.md', '# Authentication uses short-lived tokens\n\nBody');
  assert.ok(r.includes('Authentication'));
  assert.ok(!r.includes('2024'));
});

test('curator: renameProposals finds timestamp-shaped notes', () => {
  const root = makeVault();
  const r = curator.renameProposals(root, {});
  assert.ok(r.some((p) => p.from.includes('2024-01-15')));
  fs.rmSync(root, { recursive: true, force: true });
});

test('curator: linkProposals finds shared terms', () => {
  const root = makeVault();
  const r = curator.linkProposals(root, {});
  assert.ok(r.some((p) => p.from.includes('Daily') && p.to.includes('TokenRefresh')));
  fs.rmSync(root, { recursive: true, force: true });
});

test('curator: pruneCandidates is hub-aware', () => {
  const root = makeVault();
  const r = curator.pruneCandidates(root, {});
  assert.ok(r.some((p) => p.file === 'Old note.md'));
  assert.ok(!r.some((p) => p.file.includes('MOC')));
  fs.rmSync(root, { recursive: true, force: true });
});

test('curator: report is dry-run by default and structured', () => {
  const root = makeVault();
  const r = curator.report(root, {});
  assert.equal(r.ok, true);
  assert.equal(r.dryRun, true);
  assert.ok(Array.isArray(r.renames));
  assert.ok(Array.isArray(r.links));
  assert.ok(Array.isArray(r.prune));
  fs.rmSync(root, { recursive: true, force: true });
});

test('curator: MCP tool exposed and dispatch works', () => {
  const names = curator.tools().map((t) => t.name);
  assert.deepEqual(names, ['vault_curator_report']);
  const root = makeVault();
  const r = curator.dispatch('vault_curator_report', { dir: root });
  assert.equal(r.ok, true);
  fs.rmSync(root, { recursive: true, force: true });
});

// ---- slop scanner ----

test('slop: scanText finds buzzwords with severity', () => {
  const r = slop.scanText('Our cutting-edge platform is a game-changer in the evolving landscape.');
  assert.ok(r.findings.length >= 2);
  assert.ok(r.findings.some((f) => f.severity === 'high'));
  assert.ok(r.score > 0);
});

test('slop: scanText passes concrete writing', () => {
  const r = slop.scanText('The report lists accounts that canceled last week and the reason each customer gave.');
  assert.equal(r.pass, true);
  assert.equal(r.findings.length, 0);
});

test('slop: scanUi detects generic gradients', () => {
  const r = slop.scanUi('<div class="bg-gradient-to-r from-purple-500 to-blue-500 rounded-2xl shadow-xl card">Hi</div>');
  assert.ok(r.findings.some((f) => f.rule === 'generic-gradient'));
  assert.ok(r.findings.some((f) => f.rule === 'rounded-xl'));
});

test('slop: scanUi passes plain deliberate markup', () => {
  const r = slop.scanUi('<main class="prose"><h1>Report</h1><p>Concrete numbers.</p></main>');
  assert.equal(r.pass, true);
});

test('slop: rewriteLoop is bounded with stop gate', () => {
  const r = slop.rewriteLoop({});
  assert.equal(r.ok, true);
  assert.equal(r.maxRounds, 3);
  assert.ok(r.steps.some((s) => s.includes('Stop once')));
});

test('slop: MCP tools exposed and dispatch works', () => {
  const names = slop.tools().map((t) => t.name);
  assert.deepEqual(names, ['slop_scan_text', 'slop_scan_ui', 'slop_rewrite_loop']);
  assert.equal(slop.dispatch('slop_scan_text', { text: 'safe concrete text' }).pass, true);
  assert.equal(slop.dispatch('slop_scan_ui', { source: '<p>ok</p>' }).pass, true);
});
