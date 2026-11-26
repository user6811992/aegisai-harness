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
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function boot(args, env, ms) {
  return new Promise((resolve, reject) => {
    const port = 19600 + Math.floor(Math.random() * 400);
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

test('v080: TUI sanitizes ANSI and newlines in messages, sidebar, status', () => {
  const tui = read('src/tui.js');
  assert.match(tui, /function sanitizeLine/);
  assert.match(tui, /sanitizeLine\(m\.content\)/);
  assert.match(tui, /sanitizeLine\(sl\)/);
  assert.match(tui, /sanitizeLine\(this\.status\)/);
  const { sanitizeLine } = require('../src/tui');
  assert.equal(sanitizeLine('a\x1b[31mred\x1b[0mb'), 'aredb');
  assert.equal(sanitizeLine('line1\nline2'), 'line1 line2');
  assert.equal(sanitizeLine('\x1b]0;title\x07ok'), 'ok');
});

test('v080: standalone MCP server enforces AEGISAI_TOKEN', async () => {
  const port = 19650;
  const child = spawn(process.execPath, [path.join(ROOT, 'src', 'index.js'), '--mcp-server', '--port', String(port)], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { AEGISAI_TOKEN: 'sekret', AEGISAI_AUTO_START_OLLAMA: 'false' }),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await new Promise((resolve, reject) => {
      let out = '';
      child.stdout.on('data', (d) => { out += d.toString(); if (/MCP server at/.test(out)) resolve(); });
      child.on('exit', (c) => reject(new Error('exited ' + c + ': ' + out.slice(0, 200))));
      setTimeout(() => reject(new Error('timeout: ' + out.slice(0, 200))), 12000).unref();
    });
    const unauth = await request(port, 'POST', '/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    assert.equal(unauth.status, 401);
    const auth = await request(port, 'POST', '/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't' } } }, { Authorization: 'Bearer sekret' });
    assert.equal(auth.status, 200);
  } finally { try { child.kill(); } catch (e) {} }
});

test('v080: secondary pages load the auth shim', () => {
  for (const page of ['plugins.html', 'dag.html', 'trajectory.html']) {
    assert.match(read('public/' + page), /<script src="\/authtoken\.js">/, page + ' missing auth shim');
  }
  const shim = read('public/authtoken.js');
  assert.match(shim, /Authorization/);
  assert.match(shim, /EventSource/);
  assert.match(shim, /withToken/);
});

test('v080: service worker is network-first for navigations', () => {
  const sw = read('public/sw.js');
  assert.match(sw, /isNavigation/);
  assert.match(sw, /req\.mode === 'navigate'/);
  assert.match(sw, /fetch\(req\)\.then\(\(res\) => \{/);
  assert.ok(/aegisai-harness-v7/.test(sw), 'cache version not bumped');
});

test('v080: authtoken.js is served publicly with a token set', async () => {
  const { child, port } = await boot(['--web'], { AEGISAI_TOKEN: 'sekret' });
  try {
    const r = await request(port, 'GET', '/authtoken.js');
    assert.equal(r.status, 200);
    assert.match(r.body, /AEGISAI_AUTH/);
  } finally { try { child.kill(); } catch (e) {} }
});
