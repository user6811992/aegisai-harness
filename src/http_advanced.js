// src/http_advanced.js
// Phased HTTP timings, CDN detection, and lightweight load simulation.
// Inspired by eelbaz/lyra (per-phase request metrics) and eelbaz/cdnshare
// (CDN identification from network metadata). Local-only: no external calls
// beyond the target being probed.
const http = require('http');
const https = require('https');

const CDN_SIGNATURES = [
  { name: 'cloudflare', re: /cloudflare|cf-cache-status|cf-ray/i },
  { name: 'fastly', re: /fastly|x-fastly/i },
  { name: 'akamai', re: /akamai|x-akamai/i },
  { name: 'amazon-cloudfront', re: /cloudfront|x-amz-cf/i },
  { name: 'vercel', re: /vercel|x-vercel/i },
  { name: 'netlify', re: /netlify/i },
  { name: 'google-cloud-cdn', re: /google front end|gfonts|x-goog/i },
  { name: 'azure-front-door', re: /azure|x-azure/i },
  { name: 'imperva', re: /imperva|incapsula/i },
  { name: 'sucuri', re: /sucuri/i },
  { name: 'bing-cdn', re: /bing|Tk/i },
];

function detectCdn(headers) {
  const h = headers || {};
  const hay = [h.server, h.via, h['x-cache'], h['x-powered-by'], h['cf-ray'],
    h['x-amz-cf-id'], h['x-fastly-request-id'], h['x-vercel-id']]
    .filter(Boolean).join(' ');
  const found = [];
  for (const sig of CDN_SIGNATURES) {
    if (sig.re.test(hay) && !found.includes(sig.name)) found.push(sig.name);
  }
  return { cdns: found, evidence: hay.slice(0, 300) };
}

function nsMs(a, b) {
  if (!a || !b) return null;
  return Number((b - a) / 1000000n);
}

// Perform one GET with phase timing via Node's http/https modules.
function timedGet(url, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    let u;
    try { u = new URL(url); } catch (e) { resolve({ ok: false, error: 'invalid url', errorDetail: String(e.message || e), timings: {} }); return; }
    const mod = u.protocol === 'https:' ? https : http;
    const t0 = process.hrtime.bigint();
    let tLookup = null, tConnect = null, tSecure = null, tResponse = null, tEnd = null;
    let settled = false;
    const done = (payload) => {
      if (settled) return;
      settled = true;
      resolve(payload);
    };
    const req = mod.request(u, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'User-Agent': 'aegisai-lyra-probe' }, opts.headers || {}),
      timeout: opts.timeoutMs || 8000,
    }, (res) => {
      tResponse = process.hrtime.bigint();
      let bytes = 0;
      res.on('data', (chunk) => { bytes += chunk.length; });
      res.on('end', () => {
        tEnd = process.hrtime.bigint();
        done({
          ok: true,
          status: res.statusCode,
          headers: res.headers,
          bytes,
          durationMs: nsMs(t0, tEnd),
          timings: {
            dnsMs: nsMs(t0, tLookup),
            tcpMs: nsMs(tLookup, tConnect),
            tlsMs: nsMs(tConnect, tSecure),
            serverMs: nsMs(tSecure || tConnect || tLookup || t0, tResponse),
            transferMs: nsMs(tResponse, tEnd),
          },
        });
      });
    });
    req.on('socket', (socket) => {
      const attach = () => {
        socket.once('lookup', () => { tLookup = process.hrtime.bigint(); });
        socket.once('connect', () => { tConnect = process.hrtime.bigint(); });
        if (u.protocol === 'https:') socket.once('secureConnect', () => { tSecure = process.hrtime.bigint(); });
      };
      if (socket.connecting) attach();
      else { tLookup = tConnect = tSecure = process.hrtime.bigint(); }
    });
    req.on('error', (e) => done({ ok: false, error: String((e && e.message) || e), timings: {} }));
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end();
  });
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

async function loadTest(url, opts) {
  opts = opts || {};
  const users = Math.max(1, Math.min(64, opts.virtualUsers || 1));
  const perUser = Math.max(1, Math.min(1000, opts.requestsPerUser || 1));
  const started = Date.now();
  const latencies = [];
  let ok = 0, failed = 0;
  async function worker() {
    for (let i = 0; i < perUser; i += 1) {
      const r = await timedGet(url, opts);
      if (r.ok) ok += 1; else failed += 1;
      if (r.durationMs != null) latencies.push(r.durationMs);
    }
  }
  await Promise.all(Array.from({ length: users }, worker));
  latencies.sort((a, b) => a - b);
  const sum = latencies.reduce((a, b) => a + b, 0);
  return {
    url,
    virtualUsers: users,
    requests: ok + failed,
    ok,
    failed,
    durationMs: Date.now() - started,
    latency: {
      min: latencies.length ? latencies[0] : null,
      mean: latencies.length ? +(sum / latencies.length).toFixed(2) : null,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: latencies.length ? latencies[latencies.length - 1] : null,
    },
    requestsPerSecond: +( (ok + failed) / Math.max(0.001, (Date.now() - started) / 1000) ).toFixed(2),
  };
}

function tools() {
  return [
    { name: 'http_probe_timing', description: 'Measure DNS/TCP/TLS/server/transfer phases for a URL.', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
    { name: 'http_detect_cdn', description: 'Identify the CDN serving a URL from response headers.', inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
    { name: 'http_load_test', description: 'Run a small virtual-user load test against a URL (opt-in).', inputSchema: { type: 'object', properties: { url: { type: 'string' }, virtualUsers: { type: 'number' }, requestsPerUser: { type: 'number' } }, required: ['url'] } },
  ];
}

async function dispatch(name, args) {
  args = args || {};
  if (name === 'http_probe_timing') return timedGet(args.url, args);
  if (name === 'http_detect_cdn') {
    const r = await timedGet(args.url, args);
    return Object.assign({ ok: r.ok, status: r.status, error: r.error }, detectCdn(r.headers));
  }
  if (name === 'http_load_test') return loadTest(args.url, args);
  throw new Error('unknown http_advanced tool: ' + name);
}

module.exports = { detectCdn, timedGet, loadTest, percentile, tools, dispatch, CDN_SIGNATURES };
