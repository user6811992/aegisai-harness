// src/code_sandbox.js
// Run code snippets in isolated containers (Docker/Podman) or a local subprocess fallback.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LANGUAGES = {
  'python': { image: 'python:3.12-slim', cmd: ['python', '-c'], ext: '.py' },
  'javascript': { image: 'node:22-slim', cmd: ['node', '-e'], ext: '.js' },
  'bash': { image: 'bash:5', cmd: ['bash', '-c'], ext: '.sh' },
  'go': { image: 'golang:1.22', cmd: ['go', 'run'], ext: '.go' },
  'rust': { image: 'rust:1.77', cmd: ['rustc', '-'], ext: '.rs' },
};

function detectRuntime() {
  // Check for Docker.
  try {
    const { execSync } = require('child_process');
    execSync('docker --version', { stdio: 'ignore', timeout: 5000 });
    return 'docker';
  } catch (e) {}
  // Check for Podman.
  try {
    const { execSync } = require('child_process');
    execSync('podman --version', { stdio: 'ignore', timeout: 5000 });
    return 'podman';
  } catch (e) {}
  return 'local';
}

function run(code, lang, opts) {
  opts = opts || {};
  const runtime = opts.runtime || detectRuntime();
  const langConfig = LANGUAGES[lang] || LANGUAGES['bash'];
  const timeout = opts.timeout || 30000;

  return new Promise((resolve) => {
    let child;
    const startTime = Date.now();

    if (runtime === 'docker' || runtime === 'podman') {
      const bin = runtime;
      const args = ['run', '--rm', '-i', '--network=none', '--memory=256m', '--cpus=0.5', langConfig.image].concat(langConfig.cmd).concat([code]);
      child = spawn(bin, args, { timeout });
    } else {
      // Local subprocess fallback.
      const tmpFile = path.join(os.tmpdir(), 'sandbox-' + Date.now() + langConfig.ext);
      fs.writeFileSync(tmpFile, code);
      const cmd = lang === 'python' ? 'python' : lang === 'javascript' ? 'node' : 'bash';
      child = spawn(cmd, [tmpFile], { timeout });
      // Clean up temp file after.
      child.on('close', () => { try { fs.unlinkSync(tmpFile); } catch (e) {} });
    }

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (e) {}
      resolve({ ok: false, error: 'timeout after ' + timeout + 'ms', stdout: stdout.slice(0, 10000), stderr: stderr.slice(0, 10000), durationMs: Date.now() - startTime, runtime });
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        exitCode: code,
        stdout: stdout.slice(0, 10000),
        stderr: stderr.slice(0, 10000),
        durationMs: Date.now() - startTime,
        runtime,
      });
    });

    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, error: String(e.message || e), stdout, stderr, durationMs: Date.now() - startTime, runtime });
    });
  });
}

function isAvailable() {
  const rt = detectRuntime();
  return { runtime: rt, available: rt !== 'local' || true, languages: Object.keys(LANGUAGES) };
}

module.exports = { run, detectRuntime, isAvailable, LANGUAGES };