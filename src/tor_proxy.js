// src/tor_proxy.js
// Optional Tor/proxy support for web requests (no extra dependencies).
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

function proxy() {
  return process.env.AEGISAI_TOR_PROXY || process.env.TOR_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
}

function parseProxy(p) {
  let s = String(p || '').trim();
  let socks = false;
  if (/^socks/i.test(s)) socks = true;
  s = s.replace(/^[a-z]+:\/\//i, '');
  return { endpoint: s, socks };
}

async function fetch(url, opts) {
  opts = opts || {};
  const p = proxy();
  if (!p) return global.fetch(url, opts);

  const { endpoint, socks } = parseProxy(p);
  const timeout = (opts.signal && opts.signal.timeout) ? undefined : 15;
  const args = ['--silent', '--show-error', '--location', '--max-time', String(timeout || 15)];
  if (socks) args.push('--socks5-hostname', endpoint);
  else args.push('--proxy', endpoint);
  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) args.push('-H', k + ': ' + v);
  }
  if (opts.method && opts.method.toUpperCase() !== 'GET') {
    args.push('-X', opts.method.toUpperCase());
    if (opts.body) args.push('--data', typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body));
  }
  args.push('-w', '\n__HTTP_CODE__:%{http_code}');
  args.push(url);

  try {
    const { stdout, stderr } = await execFileAsync('curl', args, { maxBuffer: 10 * 1024 * 1024 });
    const marker = '\n__HTTP_CODE__:';
    const idx = stdout.lastIndexOf(marker);
    const body = idx >= 0 ? stdout.slice(0, idx) : stdout;
    const code = idx >= 0 ? parseInt(stdout.slice(idx + marker.length).trim(), 10) : 0;
    return {
      ok: code >= 200 && code < 300,
      status: code,
      async text() { return body; },
      async json() { return JSON.parse(body); },
    };
  } catch (e) {
    throw new Error('tor/proxy fetch failed: ' + (e.message || e));
  }
}

module.exports = { fetch, proxy };
