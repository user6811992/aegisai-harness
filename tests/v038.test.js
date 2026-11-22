const test = require('node:test');
const assert = require('node:assert');
const slack = require('../src/slack_gateway');
const ws = require('../src/ws_bridge');
const serverless = require('../src/serverless');
const podman = require('../src/podman');
const prReview = require('../src/pr_review');
const ci = require('../src/ci_resolver');
const cve = require('../src/cve_reachability');
const db = require('../src/storage/db');
const os = require('os');
const path = require('path');
const fs = require('fs');
const dir = path.join(os.tmpdir(), 'aegisai-v038-test');
fs.mkdirSync(dir, { recursive: true });
try { db.open(path.join(dir, 'test.db')); } catch (e) {}

test('slack parse and status', () => {
  const m = slack.parseEvent({ text: '<@U123> do the thing', channel: 'C1', user: 'U2', ts: '1' });
  assert.equal(m.text, 'do the thing');
  assert.ok('configured' in slack.status());
});

test('ws bridge status', () => {
  assert.ok('connected' in ws.status());
});

test('serverless define and list', () => {
  const a = serverless.defineAgent('test-fn', 'say hi');
  assert.equal(a.name, 'test-fn');
  assert.ok(serverless.list().some((x) => x.name === 'test-fn'));
});

test('podman status', () => {
  const s = podman.status();
  assert.ok('podman' in s);
});

test('pr review inline comments', () => {
  const c = prReview.parseInlineComments('src/a.js:12 - fix null check\nREADME.md:3 update docs');
  assert.equal(c.length, 2);
  assert.equal(c[0].line, 12);
});

test('CI allowlist', () => {
  ci.setAllowlist(['org/repo']);
  assert.equal(ci.allowed('org/repo'), true);
  assert.equal(ci.allowed('other/repo'), false);
});

test('CVE reachability', () => {
  const r = cve.prove(path.join(__dirname, '..'), 'better-sqlite3');
  assert.ok('verdict' in r);
});
