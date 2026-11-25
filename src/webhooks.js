// src/webhooks.js
// Incoming webhook triggers for agent runs.
const crypto = require('crypto');
const { runAgent } = require('./agent/run');

const handlers = new Map(); // event -> handler function

function register(event, handler) {
  handlers.set(event, handler);
}

function verifySignature(payload, signature, secret) {
  if (!secret) return true;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return 'sha256=' + hmac === signature;
}

async function handle(event, payload, opts) {
  opts = opts || {};
  const fn = handlers.get(event);
  if (!fn) return { ok: false, error: 'unhandled event: ' + event };
  const prompt = typeof fn === 'function' ? fn(payload || {}) : String(fn);
  const r = await runAgent({
    model: opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b',
    messages: [{ role: 'user', content: prompt }],
    projectRoot: opts.projectRoot || process.cwd(),
    autoApprove: opts.autoApprove !== false,
    onEvent: opts.onEvent || (() => {}),
  });
  return { ok: true, event, summary: (r.final && r.final.final) || '', toolLog: r.toolLog || [] };
}

// Default handlers
register('push', (p) => 'New push to ' + (p.repository && p.repository.full_name) + ' on ' + (p.ref || '') + '. Summarize the changes and any risks.');
register('pull_request', (p) => 'PR ' + (p.action || '') + ' in ' + (p.repository && p.repository.full_name) + ': ' + (p.pull_request && p.pull_request.title) + '. Review it.');
register('issues', (p) => 'Issue ' + (p.action || '') + ' in ' + (p.repository && p.repository.full_name) + ': ' + (p.issue && p.issue.title) + '. Triage it.');

module.exports = { register, handle, verifySignature };