// src/health_failover.js
// Provider health-check based brain failover (open-agent-sdk pattern).
const backends = require('./backends');

const STATUS_URLS = {
  anthropic: 'https://status.anthropic.com/api/v2/status.json',
  openai: 'https://status.openai.com/api/v2/status.json',
};

async function healthy(provider) {
  const url = STATUS_URLS[provider];
  if (!url) return true;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const d = await r.json();
    return d.status && d.status.indicator === 'none';
  } catch (e) { return false; }
}

async function select(providers) {
  for (const p of providers || []) {
    if (await healthy(p)) return { provider: p, healthy: true };
  }
  return { provider: null, healthy: false };
}

async function runWithFailover(brains, prompt, opts) {
  for (const b of brains || []) {
    try {
      const out = [];
      for await (const e of b.run(prompt, opts)) out.push(e);
      return { ok: true, brain: b.name, events: out };
    } catch (e) { continue; }
  }
  return { ok: false, error: 'all brains failed' };
}

module.exports = { STATUS_URLS, healthy, select, runWithFailover };
