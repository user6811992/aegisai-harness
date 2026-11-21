const test = require('node:test');
const assert = require('node:assert');
const capsule = require('../src/capsule');
const rollback = require('../src/rollback');
const taskState = require('../src/task_state');
const contentReview = require('../src/content_review');
const browser = require('../src/integrations/browser');
const db = require('../src/storage/db');
const path = require('path');
const os = require('os');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v027-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('capsule write/read', () => {
  const c = capsule.write('s1', [{ role: 'user', content: 'hello' }], { reason: 'test' });
  const r = capsule.read(c.id);
  assert.equal(r.messages[0].content, 'hello');
  assert.equal(capsule.shouldCompact(Array(100).fill({ role: 'user', content: 'x'.repeat(500) }), 0.8, 8192), true);
});

test('rollback snapshot and restore', () => {
  const p = path.join(dir, 'f.txt');
  fs.writeFileSync(p, 'original');
  const id = rollback.snapshotFile(p, dir);
  fs.writeFileSync(p, 'changed');
  const r = rollback.restore(id);
  assert.equal(r.ok, true);
  assert.equal(fs.readFileSync(p, 'utf8'), 'original');
});

test('task state create/update', () => {
  const s = taskState.create('do thing', { scope: ['a'] });
  assert.ok(s.id);
  const u = taskState.update(s.id, { status: 'done' });
  assert.equal(u.status, 'done');
});

test('content review flags slop', () => {
  const r = contentReview.review('In conclusion, it is important to note that this seamless, robust, cutting-edge, game-changing tapestry of a landscape — truly — is a testament.');
  assert.ok(r.issues.length > 0);
  assert.ok(r.score < 100);
});

test('browser AX tools present', () => {
  const names = browser.TOOLS.map((t) => t.function.name);
  assert.ok(names.includes('browser_ax'));
  assert.ok(names.includes('browser_click_ref'));
});
