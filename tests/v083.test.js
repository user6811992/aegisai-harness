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
    const port = 20700 + Math.floor(Math.random() * 400);
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

test('v083: new file through a junction is blocked', async () => {
  // Create allowed dir and outside dir + junction
  const base = path.join(os.tmpdir(), 'v083-' + Date.now());
  const allowed = path.join(base, 'allowed');
  const outside = path.join(base, 'outside');
  fs.mkdirSync(allowed, { recursive: true });
  fs.mkdirSync(outside, { recursive: true });
  // Create junction (Windows only)
  try { require('child_process').execSync('mklink /J "' + path.join(allowed, 'link') + '" "' + outside + '"', { stdio: 'ignore' }); }
  catch (e) { /* skip on non-Windows */ return; }
  const { child, port } = await boot(['--web'], { AEGISAI_PROJECT_ROOT_ALLOWLIST: allowed });
  try {
    const target = path.join(allowed, 'link', 'brand-new.txt');
    const r = await request(port, 'POST', '/api/file', { path: target, content: 'pwned' });
    assert.notEqual(r.status, 200, 'expected non-200, got ' + r.status);
    // outside dir should NOT contain the file
    assert.ok(!fs.existsSync(path.join(outside, 'brand-new.txt')), 'file was created outside');
  } finally {
    try { child.kill(); } catch (e) {}
    try { fs.rmSync(base, { recursive: true, force: true }); } catch (e) {}
  }
});

test('v083: assertAllowedPath resolves parent for non-existent targets', () => {
  const src = read('src/index.js');
  assert.match(src, /fs\.realpathSync\(path\.dirname\(resolved\)\)/);
});

test('v085: Use button checks r.ok before updating config', () => {
  const app = read('public/app.js');
  assert.match(app, /if \(!r\.ok\) \{/);
  assert.match(app, /setCfg\(\{ \.\.\.cfg, AEGISAI_MODEL: selected \}\)/);
});

test('v085: onboarding finish checks r.ok', () => {
  const app = read('public/app.js');
  // Count occurrences of r.ok check in finish context
  assert.ok(/if \(!r\.ok\) \{\s*\n\s*let msg = 'HTTP '/.test(app), 'onboarding r.ok check missing');
});

test('v085: SW cache version is v7', () => {
  const sw = read('public/sw.js');
  assert.match(sw, /aegisai-harness-v7/);
});
