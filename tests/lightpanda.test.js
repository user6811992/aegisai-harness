const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const lp = require('../src/lightpanda');
const defaultSkills = require('../src/default_skills');

test('lightpanda: available returns structured status', () => {
  const a = lp.available();
  assert.equal(typeof a.available, 'boolean');
  assert.ok(Array.isArray(a.candidates));
  assert.ok(a.candidates.length > 0);
});

test('lightpanda: cdpUrl defaults to port 9223', () => {
  const prev = process.env.LIGHTPANDA_CDP_URL;
  delete process.env.LIGHTPANDA_CDP_URL;
  assert.equal(lp.cdpUrl(), 'http://127.0.0.1:9223');
  assert.equal(lp.cdpUrl({ port: 9999 }), 'http://127.0.0.1:9999');
  if (prev) process.env.LIGHTPANDA_CDP_URL = prev;
});

test('lightpanda: cdpUrl respects env override', () => {
  const prev = process.env.LIGHTPANDA_CDP_URL;
  process.env.LIGHTPANDA_CDP_URL = 'http://127.0.0.1:7777';
  assert.equal(lp.cdpUrl(), 'http://127.0.0.1:7777');
  if (prev) process.env.LIGHTPANDA_CDP_URL = prev; else delete process.env.LIGHTPANDA_CDP_URL;
});

test('lightpanda: available false when binary missing returns error on start', () => {
  const prev = process.env.LIGHTPANDA_BIN;
  process.env.LIGHTPANDA_BIN = path.join(os.tmpdir(), 'no-such-lightpanda-' + Date.now());
  const r = lp.start();
  assert.equal(r.ok, false);
  assert.ok(r.error.includes('not found'));
  if (prev) process.env.LIGHTPANDA_BIN = prev; else delete process.env.LIGHTPANDA_BIN;
});

test('lightpanda: version reports unavailable cleanly', () => {
  const prev = process.env.LIGHTPANDA_BIN;
  process.env.LIGHTPANDA_BIN = path.join(os.tmpdir(), 'no-such-lightpanda-' + Date.now());
  const r = lp.version();
  assert.equal(r.ok, false);
  if (prev) process.env.LIGHTPANDA_BIN = prev; else delete process.env.LIGHTPANDA_BIN;
});

test('lightpanda: PandaScript save/list works', () => {
  const prev = process.env.AEGISAI_DATA_DIR;
  const tmp = path.join(os.tmpdir(), 'aegisai-lp-' + Date.now());
  process.env.AEGISAI_DATA_DIR = tmp;
  try {
    delete require.cache[require.resolve('../src/core/config')];
    const fresh = require('../src/lightpanda');
    const r = fresh.saveScript('test-nav', [{ tool: 'browser_navigate', args: { url: 'http://example.com' } }]);
    assert.equal(r.ok, true);
    assert.ok(fs.existsSync(r.path));
    const list = fresh.listScripts();
    assert.ok(list.some((s) => s.name === 'test-nav'));
  } finally {
    if (prev == null) delete process.env.AEGISAI_DATA_DIR; else process.env.AEGISAI_DATA_DIR = prev;
    delete require.cache[require.resolve('../src/core/config')];
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
});

test('lightpanda: runScript dryRun does not call browser', () => {
  const prev = process.env.AEGISAI_DATA_DIR;
  const tmp = path.join(os.tmpdir(), 'aegisai-lp-run-' + Date.now());
  process.env.AEGISAI_DATA_DIR = tmp;
  try {
    delete require.cache[require.resolve('../src/core/config')];
    const fresh = require('../src/lightpanda');
    fresh.saveScript('replay', [{ tool: 'browser_navigate', args: { url: 'http://x' } }]);
    const r = fresh.runScript('replay', { dryRun: true });
    assert.ok(r instanceof Promise || r.ok === true);
    return Promise.resolve(r).then((res) => {
      assert.equal(res.ok, true);
      assert.equal(res.results[0].dryRun, true);
    });
  } finally {
    if (prev == null) delete process.env.AEGISAI_DATA_DIR; else process.env.AEGISAI_DATA_DIR = prev;
    delete require.cache[require.resolve('../src/core/config')];
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  }
});

test('lightpanda: skill exposes interfaces and rules', () => {
  const s = lp.skill();
  assert.equal(s.name, 'lightpanda');
  assert.ok(s.body.includes('CLI fetch'));
  assert.ok(s.body.includes('PandaScript'));
  assert.ok(s.body.includes('offline mode'));
});

test('lightpanda: bundled in default skills', () => {
  const s = defaultSkills.get('lightpanda');
  assert.ok(s);
  assert.equal(s.name, 'lightpanda');
});

test('lightpanda: MCP tools exposed and dispatch works', async () => {
  const names = lp.tools().map((t) => t.name);
  assert.ok(names.includes('lightpanda_available'));
  assert.ok(names.includes('lightpanda_fetch'));
  const status = await lp.dispatch('lightpanda_available', {});
  assert.equal(typeof status.available, 'boolean');
  const s = await lp.dispatch('lightpanda_skill', {});
  assert.equal(s.name, 'lightpanda');
});
