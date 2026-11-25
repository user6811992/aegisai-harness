const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

function request(port, method, p, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers: { 'Content-Type': 'application/json' } }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function bootWeb(env, ms) {
  return new Promise((resolve, reject) => {
    const port = 18080 + Math.floor(Math.random() * 500);
    const child = spawn(process.execPath, [path.join(ROOT, 'src', 'index.js'), '--web'], {
      cwd: ROOT,
      env: Object.assign({}, process.env, { PORT: String(port), HOST: '127.0.0.1', AEGISAI_AUTO_START_OLLAMA: 'false' }, env || {}),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const onData = (d) => {
      out += d.toString();
      if (out.includes('Web UI at')) { child.stdout.off('data', onData); resolve({ child, port }); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('exit', (code) => reject(new Error('server exited ' + code + ': ' + out.slice(0, 400))));
    setTimeout(() => reject(new Error('boot timeout: ' + out.slice(0, 300))), ms || 15000).unref();
  });
}

test('v075: projects reject traversal names', () => {
  const projects = require('../src/projects');
  for (const bad of ['../escape', '..\\escape', '/abs', 'a/b', 'a\\b', '']) {
    assert.throws(() => projects.create(bad, 'x'), /invalid project name|required/, 'accepted ' + JSON.stringify(bad));
  }
  // ../evil.md is sanitized to its basename rather than escaping.
  const saved = projects.addDoc('ok', '../evil.md', 'x');
  assert.equal(saved.file, 'evil.md');
  fs.rmSync(require('../src/core/config').DATA_DIR + '/projects/ok', { recursive: true, force: true });
});

test('v075: chat SSE writes real newlines, not literal backslash-n', () => {
  const src = read('src/index.js');
  const sseLines = src.split('\n').filter((l) => l.includes("res.write('data: '"));
  assert.ok(sseLines.length > 0, 'no SSE writes found');
  for (const l of sseLines) {
    assert.ok(!l.includes("'\\\\n\\\\n'"), 'literal backslash-n in SSE: ' + l.trim().slice(0, 120));
  }
});

test('v075: service worker never caches /api', () => {
  const sw = read('public/sw.js');
  assert.match(sw, /pathname\.startsWith\('\/api\/'\)/);
});

test('v075: web UI sends Authorization and rejects non-2xx', () => {
  const app = read('public/app.js');
  assert.match(app, /Authorization = 'Bearer '/);
  assert.match(app, /if \(!r\.ok\)/);
  assert.match(app, /aegisai-unauthorized/);
});

test('v075: /api/context does not reference TUI-scoped lastToolLog', () => {
  const src = read('src/index.js');
  const ctxIdx = src.indexOf("'/api/context'");
  assert.ok(ctxIdx > 0);
  const window = src.slice(ctxIdx, ctxIdx + 700);
  assert.ok(!window.includes('lastToolLog'), '/api/context still references lastToolLog');
});

test('v075: rate limiter only applies to /api', () => {
  assert.match(read('src/index.js'), /rateLimit > 0 && req\.url\.split\('\?'\)\[0\]\.startsWith\('\/api\/'\)/);
});

test('v075: ACP/A2A report the runtime version', () => {
  assert.match(read('src/acp.js'), /require\('\.\/version'\)\.VERSION/);
  assert.match(read('src/a2a.js'), /require\('\.\/version'\)\.VERSION/);
});

test('v075: web server survives bad input (regression: /api/projects)', async () => {
  const { child, port } = await bootWeb();
  try {
    const bad = await request(port, 'POST', '/api/projects', 'not-json');
    assert.ok(bad.status >= 400 && bad.status < 600, 'expected error status, got ' + bad.status);
    // Server must still be alive.
    const alive = await request(port, 'GET', '/api/version');
    assert.equal(alive.status, 200);
    assert.ok(JSON.parse(alive.body).version);
    // /api/context must not kill the process.
    const ctx = await request(port, 'GET', '/api/context');
    assert.equal(ctx.status, 200);
    const stillAlive = await request(port, 'GET', '/api/version');
    assert.equal(stillAlive.status, 200);
  } finally { try { child.kill(); } catch (e) {} }
});

test('v075: /api/sessions lists and returns a session', async () => {
  const { child, port } = await bootWeb();
  try {
    const list = await request(port, 'GET', '/api/sessions');
    assert.equal(list.status, 200);
    const parsed = JSON.parse(list.body);
    assert.ok(Array.isArray(parsed.sessions));
    const one = await request(port, 'GET', '/api/sessions?id=default');
    assert.equal(one.status, 200);
    assert.ok(Array.isArray(JSON.parse(one.body).messages));
  } finally { try { child.kill(); } catch (e) {} }
});

test('v075: large request bodies are rejected with 413', async () => {
  const { child, port } = await bootWeb({ AEGISAI_MAX_BODY_BYTES: '1000' });
  try {
    const big = 'x'.repeat(5000);
    const r = await request(port, 'POST', '/api/chat', JSON.stringify({ message: big }));
    assert.equal(r.status, 413);
    const alive = await request(port, 'GET', '/api/version');
    assert.equal(alive.status, 200);
  } finally { try { child.kill(); } catch (e) {} }
});
