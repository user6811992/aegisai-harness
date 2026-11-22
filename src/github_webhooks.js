// src/github_webhooks.js
// GitHub webhook event-driven agents (deer-flow "GitHub Event-Driven Agents").
const crypto = require('crypto');
const { runAgent } = require('./agent/run');
const scheduler = require('./scheduler');

function verifySignature(payload, signature, secret) {
  if (!secret) return true;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return 'sha256=' + hmac === signature;
}

async function handle(event, payload, opts) {
  opts = opts || {};
  const handlers = {
    'push': (p) => 'New push to ' + p.repository.full_name + ' on ' + p.ref + '. Summarize the changes and any risks.',
    'pull_request': (p) => 'PR ' + (p.action || '') + ' in ' + p.repository.full_name + ': ' + (p.pull_request && p.pull_request.title) + '. Review it.',
    'issues': (p) => 'Issue ' + (p.action || '') + ' in ' + p.repository.full_name + ': ' + (p.issue && p.issue.title) + '. Triage it.',
    'workflow_run': (p) => 'Workflow ' + (p.workflow_run && p.workflow_run.name) + ' ' + (p.action || '') + ' in ' + p.repository.full_name + '. Summarize.',
  };
  const fn = handlers[event];
  if (!fn) return { ok: false, error: 'unhandled event: ' + event };
  const prompt = fn(payload || {});
  const r = await runAgent({ model: opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: prompt }], projectRoot: opts.projectRoot || process.cwd(), autoApprove: true, onEvent: () => {} });
  return { ok: true, event, summary: (r.final && r.final.final) || '', toolLog: r.toolLog || [] };
}

module.exports = { verifySignature, handle };
