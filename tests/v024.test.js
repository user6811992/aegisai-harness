const test = require('node:test');
const assert = require('node:assert');
const md = require('../src/markdown_extract');
const ro = require('../src/read_only');
const teams = require('../src/teams');
const db = require('../src/storage/db');
const path = require('path');
const os = require('os');
const dir = path.join(os.tmpdir(), 'aegisai-v024-test');
require('fs').mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('markdown extraction strips scripts and formats headings', () => {
  const out = md.fromHTML('<script>bad()</script><h1>Title</h1><p>Hello <b>world</b></p>', 'http://x');
  assert.ok(out.includes('# Title'));
  assert.ok(!out.includes('bad()'));
  assert.ok(out.includes('Source: http://x'));
});

test('read-only enforcement blocks destructive tools', () => {
  assert.equal(ro.enforce('read_file', true).allowed, true);
  assert.equal(ro.enforce('write_file', true).allowed, false);
  assert.equal(ro.enforce('write_file', false).allowed, true);
});

test('team create and list', () => {
  teams.create('testteam', { specialists: [{ name: 'a' }, { name: 'b' }] });
  assert.ok(teams.get('testteam'));
  assert.ok(teams.list().some((t) => t.name === 'testteam'));
});
