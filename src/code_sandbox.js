// src/code_sandbox.js
// Run code snippets in isolated containers (Docker/Podman) or a local subprocess fallback.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const LANGUAGES = {
  'python': { image: 'python:3.12-slim', runCmd: (f) => ['python', f], ext: '.py', localCmd: 'python' },
  'javascript': { image: 'node:22-slim', runCmd: (f) => ['node', f], ext: '.js', localCmd: 'node' },
  'bash': { image: 'bash:5', runCmd: (f) => ['bash', f], ext: '.sh', localCmd: process.platform === 'win32' ? null : 'bash' },
  'go': { image: 'golang:1.22', runCmd: (f) => ['go', 'run', f], ext: '.go', localCmd: 'go' },
  'rust': { image: 'rust:1.77', runCmd: (f) => { const out = f.replace(/\.rs$/, ''); return ['sh', '-c', 'rustc ' + f + ' -o ' + out + ' && ' + out]; }, ext: '.rs', localCmd: 'rustc' },
};

function detectRuntime() {
  try {
    const { execSync } = require('child_process');
    execSync('docker --version', { stdio: 'ignore', timeout: 5000 });
    return 'docker';
  } catch (e) {}
  try {
    const { execSync } = require('child_process');
    execSync('podman --version', { stdio: 'ignore', timeout: 5000 });
    return 'podman';
  } catch (e) {}
  return 'local';
}

function run(code, lang, opts) {
  opts = opts || {};
  // Do not accept runtime from caller; use server-configured mode.
  const runtime = detectRuntime();
  const allowLocal = process.env.AEGISAI_SANDBOX_ALLOW_LOCAL === 'true';
  if (runtime === 'local' && !allowLocal) {
    return Promise.resolve({ ok: false, error: 'no container runtime available; set AEGISAI_SANDBOX_ALLOW_LOCAL=true to enable unsafe local execution', runtime: 'none' });
  }
  const langConfig = LANGUAGES[lang];
  if (!langConfig) return Promise.resolve({ ok: false, error: 'unsupported language: ' + lang, runtime });
  if (typeof code !== 'string') return Promise.resolve({ ok: false, error: 'code must be a string', runtime });
  const timeout = Math.min(opts.timeout || 30000, 120000); // cap at 2 minutes

  return new Promise((resolve) => {
    const startTime = Date.now();
    const tmpFile = path.join(os.tmpdir(), 'sandbox-' + Date.now() + langConfig.ext);
    fs.writeFileSync(tmpFile, code);
    let child;
    let cleanup = () => { try { fs.unlinkSync(tmpFile); } catch (e) {} };

    if (runtime === 'docker' || runtime === 'podman') {
      const bin = runtime;
      const args = ['run', '--rm', '-i', '--network=none', '--memory=256m', '--cpus=0.5', '-v', tmpFile + ':/tmp/code' + langConfig.ext + ':ro', langConfig.image].concat(langConfig.runCmd('/tmp/code' + langConfig.ext));
      child = spawn(bin, args, { timeout });
    } else {
      // Local subprocess fallback.
      if (!langConfig.localCmd) {
        cleanup();
        resolve({ ok: false, error: 'language ' + lang + ' is not available on this platform', runtime: 'local', durationMs: 0 });
        return;
      }
      if (lang === 'rust') {
        const out = tmpFile.replace(/\.rs$/, '');
        child = spawn('sh', ['-c', 'rustc ' + tmpFile + ' -o ' + out + ' && ' + out], { timeout, shell: true });
      } else if (lang === 'go') {
        child = spawn('go', ['run', tmpFile], { timeout });
      } else if (lang === 'bash') {
        child = spawn('bash', [tmpFile], { timeout });
      } else {
        child = spawn(langConfig.localCmd, [tmpFile], { timeout });
      }
    }

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (e) {}
      cleanup();
      resolve({ ok: false, error: 'timeout after ' + timeout + 'ms', stdout: stdout.slice(0, 10000), stderr: stderr.slice(0, 10000), durationMs: Date.now() - startTime, runtime });
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timer);
      cleanup();
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
      cleanup();
      resolve({ ok: false, error: String(e.message || e), stdout, stderr, durationMs: Date.now() - startTime, runtime });
    });
  });
}

function isAvailable() {
  const rt = detectRuntime();
  return { runtime: rt, available: true, languages: Object.keys(LANGUAGES) };
}

module.exports = { run, detectRuntime, isAvailable, LANGUAGES };