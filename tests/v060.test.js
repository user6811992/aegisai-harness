const test = require('node:test');
const assert = require('node:assert');
const diffReview = require('../src/diff_review');
const git = require('../src/git_integration');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const dir = path.join(os.tmpdir(), 'aegisai-v060-test');
fs.mkdirSync(dir, { recursive: true });
try { execSync('git init', { cwd: dir, stdio: 'ignore' }); } catch (e) {}
try { execSync('git config user.email "t@t.com"', { cwd: dir, stdio: 'ignore' }); } catch (e) {}
try { execSync('git config user.name "T"', { cwd: dir, stdio: 'ignore' }); } catch (e) {}
fs.writeFileSync(path.join(dir, 'a.txt'), 'hello\n');
execSync('git add -A && git commit -m "init"', { cwd: dir, stdio: 'ignore' });

test('parseDiff empty', () => {
  const files = diffReview.parseDiff('');
  assert.deepEqual(files, []);
});

test('parseDiff single file', () => {
  const diff = `diff --git a/a.txt b/a.txt
--- a/a.txt
+++ b/a.txt
@@ -1 +1 @@
-hello
+world
`;
  const files = diffReview.parseDiff(diff);
  assert.equal(files.length, 1);
  assert.equal(files[0].file, 'a.txt');
  assert.equal(files[0].added, 1);
  assert.equal(files[0].removed, 1);
  assert.equal(files[0].hunks.length, 1);
});

test('review unstaged', () => {
  fs.writeFileSync(path.join(dir, 'a.txt'), 'changed\n');
  const r = diffReview.review(dir);
  assert.equal(r.ok, true);
  assert.ok(r.summary.length >= 1);
  assert.equal(r.summary[0].file, 'a.txt');
});

test('fullReview', () => {
  const r = diffReview.fullReview(dir);
  assert.equal(r.ok, true);
  assert.ok(Array.isArray(r.unstaged));
  assert.ok(Array.isArray(r.staged));
});

test('applyHunks', () => {
  const r = diffReview.applyHunks(dir, { 'a.txt': { accept: [0], reject: [] } });
  assert.equal(r.ok, true);
  assert.equal(r.results[0].accepted, 1);
});

test('stagedReview', () => {
  git.commit(dir, 'reset', ['a.txt']);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'staged change\n');
  execSync('git add a.txt', { cwd: dir, stdio: 'ignore' });
  const r = diffReview.stagedReview(dir);
  assert.equal(r.ok, true);
  assert.ok(r.summary.length >= 1);
});
