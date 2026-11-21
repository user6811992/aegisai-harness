// src/ahp.js
// AHP-style security supervision gateway: unify all gates into one decision per action.
const policy = require('./policy');
const charter = require('./charter');
const gateway = require('./gateway');
const actionGuard = require('./action_guard');
const readOnly = require('./read_only');
const ledger = require('./ledger');

function supervise(toolName, args, ctx) {
  ctx = ctx || {};
  const checks = [];
  if (ctx.policy) {
    const p = policy.evaluate(ctx.policy, { tool_name: toolName, args });
    checks.push({ gate: 'policy', allowed: p.allowed, reason: p.rule });
  }
  if (ctx.charterObj) {
    const c = charter.enforce(ctx.charterObj, toolName, args);
    checks.push({ gate: 'charter', allowed: c.allowed, reason: c.reason || 'ok' });
  }
  if (ctx.agent) {
    const g = gateway.authorize(ctx.agent, toolName, 'execute');
    checks.push({ gate: 'gateway', allowed: g.allowed, reason: g.reason });
  }
  if (ctx.actionGuard) {
    const a = actionGuard.gate(toolName, args, { toolLog: ctx.toolLog || [] });
    checks.push({ gate: 'actionGuard', allowed: a.allowed, reason: a.reason || a.rule });
  }
  if (ctx.readOnly) {
    const r = readOnly.enforce(toolName, true);
    checks.push({ gate: 'readOnly', allowed: r.allowed, reason: r.reason || 'ok' });
  }
  const allowed = checks.every((c) => c.allowed);
  try { ledger.append('ahp_decision', { tool: toolName, allowed, checks }); } catch (e) {}
  return { allowed, checks, blockedBy: allowed ? null : checks.find((c) => !c.allowed) };
}

module.exports = { supervise };
