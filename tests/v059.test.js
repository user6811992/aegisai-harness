const nodeTest = require('node:test');
const assert = require('node:assert');
const git = require('../src/git_integration');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const hasGit = (() => { try { execSync('git --version', { stdio: 'ignore' }); return true; } catch (e) { return false; } })();
const test = hasGit ? nodeTest : ((name, fn) => nodeTest.skip(name + ' (git unavailable)', fn));

const dir = path.join(os.tmpdir(), 'aegisai-v059-test');
if (hasGit) {
  fs.mkdirSync(dir, { recursive: true });
  try { execSync('git init', { cwd: dir, stdio: 'ignore' }); } catch (e) {}
  try { execSync('git config user.email "t@t.com"', { cwd: dir, stdio: 'ignore' }); } catch (e) {}
  try { execSync('git config user.name "T"', { cwd: dir, stdio: 'ignore' }); } catch (e) {}
  fs.writeFileSync(path.join(dir, 'a.txt'), 'hello');
  execSync('git add -A && git commit -m "init"', { cwd: dir, stdio: 'ignore' });
}

test('git isRepo', () => {
  assert.equal(git.isRepo(dir), true);
  assert.equal(git.isRepo(os.tmpdir()), false);
});

test('git status', () => {
  const s = git.status(dir);
  assert.equal(s.ok, true);
  assert.equal(s.clean, true);
});

test('git status with changes', () => {
  fs.writeFileSync(path.join(dir, 'a.txt'), 'changed');
  const s = git.status(dir);
  assert.equal(s.ok, true);
  assert.equal(s.clean, false);
  assert.ok(s.files.some((f) => f.file === 'a.txt'));
});

test('git diff', () => {
  const d = git.diff(dir);
  assert.equal(d.ok, true);
  assert.ok(d.diff.includes('changed') || d.diff.includes('hello'));
});

test('git commit', () => {
  const r = git.commit(dir, 'update a.txt');
  assert.equal(r.ok, true);
  const s = git.status(dir);
  assert.equal(s.clean, true);
});

test('git log', () => {
  const l = git.log(dir);
  assert.equal(l.ok, true);
  assert.ok(l.commits.length >= 2);
});

test('git blame', () => {
  const b = git.blame(dir, 'a.txt');
  assert.equal(b.ok, true);
});

test('git branch', () => {
  const name = 'feature-' + Date.now();
  const r = git.branch(dir, name);
  assert.equal(r.ok, true);
  const branches = git.branch(dir);
  assert.ok(branches.branches.some((b) => b.includes(name)));
});

test('git stash', () => {
  fs.writeFileSync(path.join(dir, 'a.txt'), 'stashed');
  const r = git.stash(dir, 'push');
  assert.equal(r.ok, true);
  git.stash(dir, 'pop');
});

test('git autoCommit', () => {
  fs.writeFileSync(path.join(dir, 'b.txt'), 'new file');
  const r = git.autoCommit(dir, 'auto: new file');
  assert.equal(r.ok, true);
  assert.ok(!r.skipped);
});

test('git show', () => {
  const r = git.show(dir, 'HEAD');
  assert.equal(r.ok, true);
  assert.ok(r.output.length > 0);
});

test('git runGit', () => {
  const r = git.runGit(['--version'], { cwd: dir });
  assert.equal(r.ok, true);
  assert.ok(r.stdout.includes('git version'));
});
