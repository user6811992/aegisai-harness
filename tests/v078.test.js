const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
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
    const port = 19100 + Math.floor(Math.random() * 500);
    const child = spawn(process.execPath, [path.join(ROOT, 'src', 'index.js')].concat(args), {
      cwd: ROOT,
      env: Object.assign({}, process.env, { PORT: String(port), HOST: '127.0.0.1', AEGISAI_AUTO_START_OLLAMA: 'false' }, env || {}),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); if (/Web UI at/.test(out)) resolve({ child, port }); });
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('exit', (code) => reject(new Error('exited ' + code + ': ' + out.slice(0, 400))));
    setTimeout(() => reject(new Error('boot timeout: ' + out.slice(0, 300))), ms || 15000).unref();
  });
}

test('v078: static assets stay public when AEGISAI_TOKEN is set', async () => {
  const { child, port } = await boot(['--web'], { AEGISAI_TOKEN: 'sekret' });
  try {
    const shell = await request(port, 'GET', '/');
    assert.equal(shell.status, 200);
    assert.match(shell.headers['content-type'] || '', /html/);
    const js = await request(port, 'GET', '/app.js');
    assert.equal(js.status, 200);
    // API stays protected.
    const api = await request(port, 'GET', '/api/version');
    assert.equal(api.status, 401);
    // Correct token works.
    const ok = await request(port, 'GET', '/api/version', undefined, { Authorization: 'Bearer sekret' });
    assert.equal(ok.status, 200);
  } finally { try { child.kill(); } catch (e) {} }
});

test('v078: PAT scopes are enforced per route', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegisai-pat-'));
  const childEnv = { AEGISAI_TOKEN: 'sekret', AEGISAI_DATA_DIR: dataDir };
  // Boot the server, then mint PATs against the same DATA_DIR/database.
  const { child, port } = await boot(['--web'], childEnv);
  try {
    process.env.AEGISAI_DATA_DIR = dataDir;
    delete require.cache[require.resolve('../src/storage/db')];
    delete require.cache[require.resolve('../src/core/config')];
    delete require.cache[require.resolve('../src/access_tokens')];
    const db = require('../src/storage/db');
    if (!db.isOpen()) db.open(path.join(dataDir, 'harness.db'));
    const pats = require('../src/access_tokens');
    const readOnlyPat = pats.mint('ro', ['read']);
    const execPat = pats.mint('rw', ['read', 'execute']);
    const denied = await request(port, 'POST', '/api/chat', { message: 'hi' }, { Authorization: 'Bearer ' + readOnlyPat.token });
    assert.equal(denied.status, 403);
    assert.match(denied.body, /insufficient_scope/);
    const allowedRead = await request(port, 'GET', '/api/version', undefined, { Authorization: 'Bearer ' + readOnlyPat.token });
    assert.equal(allowedRead.status, 200);
    const allowedExec = await request(port, 'GET', '/api/version', undefined, { Authorization: 'Bearer ' + execPat.token });
    assert.equal(allowedExec.status, 200);
  } finally {
    try { child.kill(); } catch (e) {}
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch (e) {}
  }
});

test('v078: file API enforces the allowlist for reads and writes', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'aegisai-root-'));
  const outside = path.join(os.tmpdir(), 'aegisai-secret-' + Date.now() + '.txt');
  fs.writeFileSync(outside, 'secret');
  const { child, port } = await boot(['--web'], { AEGISAI_PROJECT_ROOT_ALLOWLIST: tmpRoot.replace(/\\/g, '/') });
  try {
    const readOut = await request(port, 'GET', '/api/file?path=' + encodeURIComponent(outside));
    assert.equal(readOut.status, 403);
    const writeOut = await request(port, 'POST', '/api/file', { path: outside, content: 'pwned' });
    assert.equal(writeOut.status, 403);
    const listOut = await request(port, 'GET', '/api/files?dir=' + encodeURIComponent(os.tmpdir()));
    assert.equal(listOut.status, 403);
    // Inside the root works.
    const inside = path.join(tmpRoot, 'ok.txt');
    fs.writeFileSync(inside, 'hello');
    const readIn = await request(port, 'GET', '/api/file?path=' + encodeURIComponent(inside));
    assert.equal(readIn.status, 200);
    assert.match(readIn.body, /hello/);
  } finally {
    try { child.kill(); } catch (e) {}
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) {}
    try { fs.unlinkSync(outside); } catch (e) {}
  }
});

test('v078: session search includes persisted sessions', () => {
  const src = read('src/index.js');
  const idx = src.indexOf("req.url.split('?')[0] === '/api/search-sessions'");
  assert.ok(idx > 0, 'route not found');
  const block = src.slice(idx, idx + 1200);
  assert.match(block, /dbSafe\(\)/);
  assert.match(block, /listSessions/);
});

test('v078: TUI paste inserts text instead of executing each line', () => {
  const tui = read('src/tui.js');
  assert.ok(!/submit each complete line/.test(tui), 'old per-line execution still present');
  assert.match(tui, /replace\(\/\[\\r\\n\]\+\/g, ' '\)/);
});

test('v078: MCP HTTP transport has a body limit and dispatch error boundary', () => {
  const src = read('src/mcp_server.js');
  assert.match(src, /AEGISAI_MCP_MAX_BODY/);
  assert.match(src, /413/);
  assert.match(src, /-32603/);
  assert.match(src, /Dispatch error boundary/);
});

test('v078: auth gate only guards /api and /mcp', () => {
  const src = read('src/index.js');
  assert.match(src, /const needsAuth = urlPathOnly\.startsWith\('\/api\/'\) \|\| urlPathOnly === '\/mcp'/);
  assert.match(src, /function requiredScope/);
  assert.match(src, /insufficient_scope/);
  assert.match(src, /function assertAllowedPath/);
});
