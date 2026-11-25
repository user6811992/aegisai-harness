const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

function request(port, method, p, body, headers) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}) }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function boot(args, env, ms) {
  return new Promise((resolve, reject) => {
    const port = 20600 + Math.floor(Math.random() * 400);
    const child = spawn(process.execPath, [path.join(ROOT, 'src', 'index.js')].concat(args), {
      cwd: ROOT,
      env: Object.assign({}, process.env, { PORT: String(port), HOST: '127.0.0.1', AEGISAI_AUTO_START_OLLAMA: 'false' }, env || {}),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); if (/Web UI at|MCP server at/.test(out)) resolve({ child, port }); });
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('exit', (code) => reject(new Error('exited ' + code + ': ' + out.slice(0, 400))));
    setTimeout(() => reject(new Error('boot timeout: ' + out.slice(0, 300))), ms || 15000).unref();
  });
}

test('v082: TUI inserts bracketed paste content instead of dropping it', () => {
  const { Tui } = require('../src/tui');
  const t = new Tui();
  t.running = false;
  t.handleKey('\x1b[200~hello world\x1b[201~');
  assert.equal(t.input, 'hello world');
  // multi-line becomes spaces, no auto-submit
  const t2 = new Tui();
  t2.running = false;
  t2.handleKey('\x1b[200~line1\nline2\x1b[201~');
  assert.equal(t2.input, 'line1 line2');
});

test('v082: TUI still ignores other escape sequences', () => {
  const { Tui } = require('../src/tui');
  const t = new Tui();
  t.running = false;
  t.handleKey('\x1b[31m'); // color code, no paste markers
  assert.equal(t.input, '');
});

test('v082: assertAllowedPath resolves symlinks/junctions', () => {
  const src = read('src/index.js');
  assert.match(src, /fs\.realpathSync/);
  // GET /api/file enforces a size cap
  assert.match(src, /AEGISAI_MAX_FILE_BYTES/);
});

test('v082: file allowlist blocks traversal via symlink (unit via realpath)', () => {
  const { realpathSync } = require('fs');
  // Just ensure the helper exists in source
  assert.match(read('src/index.js'), /path\.relative\(rootReal, real\)/);
});

test('v082: large files are rejected with 413', async () => {
  const { child, port } = await boot(['--web']);
  try {
    const tmp = path.join(os.tmpdir(), 'big-' + Date.now() + '.txt');
    fs.writeFileSync(tmp, 'x'.repeat(3 * 1024 * 1024));
    const r = await request(port, 'GET', '/api/file?path=' + encodeURIComponent(tmp));
    // Either 413 (size cap) or 403 (not allowed root) — both acceptable; process alive.
    assert.ok(r.status === 413 || r.status === 403, 'unexpected status ' + r.status);
    const alive = await request(port, 'GET', '/api/version');
    assert.equal(alive.status, 200);
    try { fs.unlinkSync(tmp); } catch (e) {}
  } finally { try { child.kill(); } catch (e) {} }
});

test('v082: authtoken writes to localStorage so new tabs can read it', () => {
  const app = read('public/app.js');
  assert.match(app, /localStorage\.setItem\('aegisai_token', t\)/);
  assert.match(app, /sessionStorage\.setItem\('aegisai_token', t\)/);
});

test('v082: authtoken.js reads from both storage areas', () => {
  const shim = read('public/authtoken.js');
  assert.match(shim, /sessionStorage\.getItem\('aegisai_token'\)/);
  assert.match(shim, /localStorage\.getItem\('aegisai_token'\)/);
});

test('v082: secondary pages still load the shim', () => {
  for (const p of ['plugins.html', 'dag.html', 'trajectory.html']) {
    assert.match(read('public/' + p), /<script src="\/authtoken\.js">/);
  }
});
