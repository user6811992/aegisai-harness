const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const ROOT = path.join(__dirname, '..');

function request(port, method, p, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers: { 'Content-Type': 'application/json' } }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

function boot(env, ms) {
  return new Promise((resolve, reject) => {
    const port = 21200 + Math.floor(Math.random() * 500);
    const child = spawn(process.execPath, [path.join(ROOT, 'src', 'index.js'), '--web'], {
      cwd: ROOT,
      env: Object.assign({}, process.env, {
        PORT: String(port),
        HOST: '127.0.0.1',
        AEGISAI_AUTO_START_OLLAMA: 'false',
        BACKEND_TYPE: 'ollama',
        BACKEND_URL: 'http://127.0.0.1:11434',
      }, env || {}),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => {
      out += d.toString();
      if (/Web UI at/.test(out)) resolve({ child, port });
    });
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('exit', (code) => reject(new Error('server exited ' + code + ': ' + out.slice(0, 300))));
    setTimeout(() => reject(new Error('boot timeout: ' + out.slice(0, 300))), ms || 15000).unref();
  });
}

function stop(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    const timer = setTimeout(resolve, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    try { child.kill(); } catch (e) { clearTimeout(timer); resolve(); }
  });
}

test('v104: chat-template tokens are stripped', () => {
  const { stripSpecialTokens } = require('../src/agent/run');
  assert.equal(stripSpecialTokens('Hello<|im_end|>'), 'Hello');
  assert.equal(stripSpecialTokens('<|im_start|>assistant\nHi<|im_end|>'), 'assistant\nHi');
  assert.equal(stripSpecialTokens('<end_of_turn>Hi<start_of_turn>'), 'Hi');
  assert.equal(stripSpecialTokens('a<|im_end|>b', false), 'ab');
});

test('v104: backend aliases normalize and validate', () => {
  const b = require('../src/backends');
  assert.equal(b.normalizeBackendType('llama.cpp'), 'llamacpp');
  assert.equal(b.normalizeBackendType('llama-cpp'), 'llamacpp');
  assert.equal(b.normalizeBackendType('llama_cpp'), 'llamacpp');
  assert.equal(b.normalizeBackendType('llama.cpp!'), 'llamacpp');
  assert.equal(b.normalizeBackendType('lm studio'), 'lmstudio');
  assert.equal(b.normalizeBackendType('open-ai'), 'openai');
  assert.equal(b.isKnownBackend('llama.cpp'), true);
  assert.equal(b.isKnownBackend('banana'), false);
});

test('v104: chat backend commands normalize, persist, and stream', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aegisai-v104-'));
  const { child, port } = await boot({ AEGISAI_DATA_DIR: dataDir });
  try {
    let r = await request(port, 'GET', '/api/backends');
    assert.equal(JSON.parse(r.body).current, 'ollama');

    r = await request(port, 'POST', '/api/chat', { message: 'change the backend to llama.cpp', sessionId: 'cmd' });
    assert.equal(r.status, 200);
    let body = JSON.parse(r.body);
    assert.match(body.reply, /Backend changed to llamacpp/);
    assert.match(body.reply, /8081/);
    assert.deepEqual(body.toolLog, []);

    r = await request(port, 'GET', '/api/backends');
    assert.equal(JSON.parse(r.body).current, 'llamacpp');
    r = await request(port, 'GET', '/api/config');
    assert.equal(JSON.parse(r.body).BACKEND_URL, 'http://127.0.0.1:8081');

    r = await request(port, 'POST', '/api/chat', { message: '/backend llama.cpp', stream: true, sessionId: 'cmd' });
    assert.equal(r.status, 200);
    assert.match(r.body, /"type":"done"/);
    assert.match(r.body, /Backend changed to llamacpp/);

    r = await request(port, 'POST', '/api/backend', { type: 'llama.cpp' });
    assert.equal(r.status, 200);
    assert.equal(JSON.parse(r.body).type, 'llamacpp');

    r = await request(port, 'POST', '/api/config', { BACKEND_TYPE: 'llama.cpp' });
    assert.equal(r.status, 200);
    r = await request(port, 'GET', '/api/backends');
    assert.equal(JSON.parse(r.body).current, 'llamacpp');

    r = await request(port, 'POST', '/api/backend', { type: 'banana' });
    assert.equal(r.status, 400);
    r = await request(port, 'POST', '/api/config', { BACKEND_TYPE: 'banana' });
    assert.equal(r.status, 400);
  } finally {
    await stop(child);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
