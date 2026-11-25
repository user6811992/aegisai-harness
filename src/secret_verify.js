// src/secret_verify.js
// Secret detection + optional live verification (trufflehog-style).
// Verification is best-effort and OFF by default; `offline: true` never egresses.
const https = require('https');

const PATTERNS = [
  { id: 'github-pat', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, provider: 'github', verify: (t) => req('api.github.com', '/user', { Authorization: 'token ' + t }) },
  { id: 'github-fine', re: /\bgithub_pat_[A-Za-z0-9_]{60,}\b/g, provider: 'github', verify: (t) => req('api.github.com', '/user', { Authorization: 'Bearer ' + t }) },
  { id: 'slack-token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, provider: 'slack', verify: (t) => req('slack.com', '/api/auth.test', { Authorization: 'Bearer ' + t }) },
  { id: 'openai-key', re: /\bsk-[A-Za-z0-9]{32,}\b/g, provider: 'openai', verify: (t) => req('api.openai.com', '/v1/models', { Authorization: 'Bearer ' + t }) },
  { id: 'aws-akid', re: /\bAKIA[0-9A-Z]{16}\b/g, provider: 'aws', verify: null },
  { id: 'stripe-live', re: /\bsk_live_[0-9a-zA-Z]{24,}\b/g, provider: 'stripe', verify: (t) => req('api.stripe.com', '/v1/charges?limit=1', { Authorization: 'Bearer ' + t }) },
  { id: 'npm-token', re: /\bnpm_[A-Za-z0-9]{36}\b/g, provider: 'npm', verify: (t) => req('registry.npmjs.org', '/-/whoami', { Authorization: 'Bearer ' + t }) },
  { id: 'google-api', re: /\bAIza[0-9A-Za-z_-]{35}\b/g, provider: 'google', verify: null },
  { id: 'sendgrid', re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g, provider: 'sendgrid', verify: (t) => req('api.sendgrid.com', '/v3/scopes', { Authorization: 'Bearer ' + t }) },
  { id: 'private-key', re: /-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/g, provider: 'key', verify: null },
  { id: 'generic-high-entropy', re: /\b[A-Za-z0-9_\-]{32,}\b/g, provider: 'unknown', verify: null, entropy: 4.2 },
];

function shannon(s) {
  const freq = new Map();
  for (const ch of s) freq.set(ch, (freq.get(ch) || 0) + 1);
  let h = 0;
  for (const c of freq.values()) { const p = c / s.length; h -= p * Math.log2(p); }
  return h;
}

function req(host, path, headers) {
  return new Promise((resolve) => {
    const r = https.request({ host, path, method: 'GET', headers: Object.assign({ 'User-Agent': 'aegisai-secret-verify' }, headers || {}) }, (res) => {
      let d = ''; res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode }));
    });
    r.on('error', () => resolve({ ok: false, status: 0 }));
    r.setTimeout(6000, () => { r.destroy(); resolve({ ok: false, status: 0 }); });
    r.end();
  });
}

function redact(s) {
  const t = String(s || '');
  if (t.length <= 8) return '****';
  return t.slice(0, 4) + '…' + t.slice(-4);
}

/** Detect secrets in text. Verification is opt-in via opts.verify. */
async function scan(text, opts) {
  opts = opts || {};
  const source = opts.source || '<inline>';
  const findings = [];
  const seen = new Set();
  for (const p of PATTERNS) {
    const re = new RegExp(p.re.source, p.re.flags);
    let m;
    let guard = 0;
    while ((m = re.exec(text)) !== null && guard++ < 500) {
      const value = m[0];
      if (seen.has(value)) continue;
      if (p.entropy && shannon(value) < p.entropy) continue;
      seen.add(value);
      const line = text.slice(0, m.index).split(/\r?\n/).length;
      let verified = null;
      if (opts.verify && p.verify && !opts.offline) {
        try { const r = await p.verify(value); verified = r.ok; } catch (e) { verified = null; }
      }
      findings.push({
        ruleId: 'secret/' + p.id,
        provider: p.provider,
        severity: verified ? 'critical' : 'high',
        source,
        line,
        redacted: redact(value),
        // Internal: needed for the independent verification pass. Stripped by callers.
        raw: value,
        verified,
        status: opts.verify ? (opts.offline ? 'not_checked_offline' : (verified === null ? 'unverifiable' : (verified ? 'live' : 'dead'))) : 'not_checked',
      });
      if (!p.re.global) break;
    }
  }
  return findings;
}

function summarize(findings) {
  const live = findings.filter((f) => f.verified === true).length;
  const dead = findings.filter((f) => f.verified === false).length;
  return {
    total: findings.length,
    live,
    dead,
    unverified: findings.length - live - dead,
    verdict: live ? 'fail' : findings.length ? 'warn' : 'pass',
  };
}

module.exports = { PATTERNS, scan, summarize, redact, shannon };
