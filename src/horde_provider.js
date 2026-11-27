// src/horde_provider.js
// AI Horde as opt-in provider — clean-room lite.koboldai.net/koboldcpp idea.
// Distributed generation network adapter. Network-dependent, opt-in only,
// disabled in offline mode. No defaults and no credentials stored here.
const BASE = 'https://aihorde.net/api/v2';

function plan(model, opts) {
  if (process.env.AEGISAI_OFFLINE === 'true') return { ok: false, error: 'AI Horde disabled in offline mode (opt-in only)' };
  opts = opts || {};
  return {
    ok: true,
    provider: 'ai-horde',
    endpoint: `${BASE}/generate/text/async`,
    model: model || 'default',
    params: { max_tokens: opts.maxTokens || 256, temperature: opts.temperature != null ? opts.temperature : 0.8 },
    note: 'requires user opt-in and an API key supplied by the caller; respects worker ToS',
  };
}

function status() {
  if (process.env.AEGISAI_OFFLINE === 'true') return { ok: true, enabled: false, reason: 'offline mode' };
  return { ok: true, enabled: false, reason: 'not enabled — set HORDE_ENABLE=true to opt in', endpoint: BASE };
}

function tools() {
  return [
    { name: 'horde_plan', description: 'Plan an opt-in AI Horde generation request.', inputSchema: { type: 'object', properties: { model: { type: 'string' } } } },
    { name: 'horde_status', description: 'Check AI Horde provider status.', inputSchema: { type: 'object' } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'horde_plan') return plan(args.model, args);
  if (name === 'horde_status') return status();
  throw new Error('unknown horde_provider tool: ' + name);
}
module.exports = { BASE, plan, status, tools, dispatch };
