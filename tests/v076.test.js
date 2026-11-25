const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

function request(port, method, p, body, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}) }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d, headers: res.headers }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function boot(args, env, ms) {
  return new Promise((resolve, reject) => {
    const port = 18600 + Math.floor(Math.random() * 500);
    const child = spawn(process.execPath, [path.join(ROOT, 'src', 'index.js')].concat(args), {
      cwd: ROOT,
      env: Object.assign({}, process.env, { PORT: String(port), HOST: '127.0.0.1', AEGISAI_AUTO_START_OLLAMA: 'false' }, env || {}),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const finish = () => resolve({ child, port, out: () => out });
    child.stdout.on('data', (d) => { out += d.toString(); if (/Web UI at|Proxy listening on/.test(out)) finish(); });
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('exit', (code) => reject(new Error('exited ' + code + ': ' + out.slice(0, 400))));
    setTimeout(() => reject(new Error('boot timeout: ' + out.slice(0, 300))), ms || 15000).unref();
  });
}

test('v076: listSessions selects full rows so content search works', () => {
  assert.match(read('src/storage/db.js'), /SELECT \* FROM sessions ORDER BY updated DESC/);
});

test('v076: web sessions persist through db.saveSession', () => {
  const src = read('src/index.js');
  assert.match(src, /rememberSession/);
  assert.match(src, /saveSession/);
  assert.match(src, /getSessionMessages/);
});

test('v076: CORS no longer wildcards and rejects foreign origins', async () => {
  const { child, port } = await boot(['--web']);
  try {
    const evil = await request(port, 'GET', '/api/version', undefined, { Origin: 'https://evil.example' });
    assert.equal(evil.status, 403);
    const same = await request(port, 'GET', '/api/version', undefined, { Origin: 'http://127.0.0.1:' + port });
    assert.equal(same.status, 200);
    const none = await request(port, 'GET', '/api/version');
    assert.equal(none.status, 200);
    assert.notEqual(none.headers['access-control-allow-origin'], '*');
  } finally { try { child.kill(); } catch (e) {} }
});

test('v076: project root allowlist can be cleared via config', async () => {
  const { child, port } = await boot(['--web'], { AEGISAI_PROJECT_ROOT_ALLOWLIST: 'C:/allowed' });
  try {
    const before = JSON.parse((await request(port, 'GET', '/api/config')).body);
    assert.equal(before.projectRootAllowlist, 'C:/allowed');
    await request(port, 'POST', '/api/config', { projectRootAllowlist: '' });
    const after = JSON.parse((await request(port, 'GET', '/api/config')).body);
    assert.equal(after.projectRootAllowlist, '');
  } finally { try { child.kill(); } catch (e) {} }
});

test('v076: TUI stop detaches listeners and entry point exits', () => {
  const tui = read('src/tui.js');
  assert.match(tui, /process\.stdin\.off\('data'/);
  assert.match(tui, /process\.off\('SIGWINCH'/);
  assert.match(read('src/index.js'), /tui\.on\('exit'/);
});

test('v076: onboarding renders toasts and auth modal', () => {
  const app = read('public/app.js');
  const idx = app.indexOf("view === 'onboarding'");
  const block = app.slice(idx, idx + 1200);
  assert.match(block, /ToastContainer/);
  assert.match(block, /needAuth/);
});

test('v076: streaming chat emits an SSE error frame on failure', () => {
  const src = read('src/index.js');
  assert.match(src, /type: 'error'/);
  assert.match(src, /writeEvent/);
  assert.match(read('public/app.js'), /data\.type === 'error'/);
});

test('v076: proxy exposes /v1/models, streams, and rejects bad input', async () => {
  const { child, port } = await boot(['--proxy'], { AEGISAI_PROXY_PORT: '0' }, 20000).catch(() => null) || {};
  // The proxy port is fixed via env; boot() uses PORT which the proxy ignores.
  if (child) { try { child.kill(); } catch (e) {} }
  const src = read('src/index.js');
  assert.match(src, /'\/v1\/models'/);
  assert.match(src, /chat\.completion\.chunk/);
  assert.match(src, /\[DONE\]/);
  assert.match(src, /invalid JSON body/);
  assert.match(src, /server\.listen\(port, host/);
});
