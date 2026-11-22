const test = require('node:test');
const assert = require('node:assert');
const channels = require('../src/channels');
const gh = require('../src/github_webhooks');
const attachments = require('../src/file_attachments');
const graphMcp = require('../src/graph_mcp');
const db = require('../src/storage/db');
const os = require('os');
const path = require('path');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v052-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('channels status', () => {
  assert.ok('channels' in channels.status());
  assert.ok(channels.list().includes('telegram'));
});

test('github webhook handle push', async () => {
  const r = await gh.handle('push', { repository: { full_name: 'a/b' }, ref: 'refs/heads/main' });
  assert.equal(r.ok, true);
  assert.ok(r.summary);
});

test('github webhook verify signature', () => {
  const crypto = require('crypto');
  const payload = '{"a":1}';
  const secret = 's';
  const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  assert.equal(gh.verifySignature(payload, sig, secret), true);
  assert.equal(gh.verifySignature(payload, 'sha256=bad', secret), false);
});

test('file attachments save/list/preview', () => {
  const a = attachments.saveAttachment('note.txt', Buffer.from('hello').toString('base64'));
  assert.ok(a.path);
  assert.ok(attachments.list().some((x) => x.name.endsWith(a.name)));
  assert.equal(attachments.previewText(a.path).text, 'hello');
});

test('graph mcp tools and handle', () => {
  assert.ok(graphMcp.tools().length >= 5);
  graphMcp.handle('create_entities', { entities: [{ name: 'Foo', entityType: 'concept' }] });
  const r = graphMcp.handle('search_nodes', { query: 'Foo' });
  assert.ok(r.content[0].text);
});
