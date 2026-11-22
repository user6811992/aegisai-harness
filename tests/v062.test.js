const test = require('node:test');
const assert = require('node:assert');
const diffReviewUi = require('../src/diff_review_ui');
const diffReview = require('../src/diff_review');
const git = require('../src/git_integration');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const dir = path.join(os.tmpdir(), 'aegisai-v062-test');
fs.mkdirSync(dir, { recursive: true });
try { execSync('git init', { cwd: dir, stdio: 'ignore' }); } catch (e) {}
try { execSync('git config user.email "t@t.com"', { cwd: dir, stdio: 'ignore' }); } catch (e) {}
try { execSync('git config user.name "T"', { cwd: dir, stdio: 'ignore' }); } catch (e) {}
fs.writeFileSync(path.join(dir, 'a.txt'), 'hello\n');
execSync('git add -A && git commit -m "init"', { cwd: dir, stdio: 'ignore' });

test('startSession', () => {
  fs.writeFileSync(path.join(dir, 'a.txt'), 'changed\n');
  const s = diffReviewUi.startSession(dir);
  assert.equal(s.ok, true);
  assert.ok(s.session.files.length >= 1);
  assert.ok(s.session.decisions['a.txt']);
});

test('acceptHunk/rejectHunk', () => {
  fs.writeFileSync(path.join(dir, 'a.txt'), 'changed\n');
  const s = diffReviewUi.startSession(dir);
  const r = diffReviewUi.acceptHunk(s.session, 0);
  assert.equal(r.ok, true);
  assert.equal(r.decision, 'accept');
  const r2 = diffReviewUi.rejectHunk(s.session, 0);
  assert.equal(r2.decision, 'reject');
});

test('acceptFile/rejectFile', () => {
  fs.writeFileSync(path.join(dir, 'a.txt'), 'changed\n');
  const s = diffReviewUi.startSession(dir);
  const r = diffReviewUi.acceptFile(s.session);
  assert.equal(r.ok, true);
  assert.equal(r.decision, 'accept-all');
});

test('navigation', () => {
  fs.writeFileSync(path.join(dir, 'a.txt'), 'changed\n');
  const s = diffReviewUi.startSession(dir);
  const n = diffReviewUi.nextHunk(s.session);
  assert.ok(n !== null);
  const p = diffReviewUi.prevHunk(s.session);
  assert.ok(p !== null);
  const st = diffReviewUi.status(s.session);
  assert.ok('decided' in st);
  assert.ok('total' in st);
});

test('renderCurrent', () => {
  fs.writeFileSync(path.join(dir, 'a.txt'), 'changed\n');
  const s = diffReviewUi.startSession(dir);
  const r = diffReviewUi.renderCurrent(s.session);
  assert.ok(r.includes('a.txt'));
});

test('finish', () => {
  fs.writeFileSync(path.join(dir, 'a.txt'), 'changed\n');
  const s = diffReviewUi.startSession(dir);
  diffReviewUi.acceptHunk(s.session, 0);
  const f = diffReviewUi.finish(s.session);
  assert.equal(f.ok, true);
  assert.ok(Array.isArray(f.accepted));
  assert.equal(s.session.done, true);
});

test('startSession with no changes', () => {
  git.commit(dir, 'reset', ['a.txt']);
  const s = diffReviewUi.startSession(dir);
  assert.equal(s.ok, true);
  assert.equal(s.session.files.length, 0);
});
