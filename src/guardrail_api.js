// src/guardrail_api.js
// Stable, documented surface for evaluating a tool call against every guardrail
// the harness already has: read-only boundary, policy rules, charter, sandbox
// rings, and the AHP supervisor. External tools can depend on this instead of
// reaching into internals.
const readOnly = require('./read_only');
const policy = require('./policy');
const charter = require('./charter');
const rings = require('./sandbox_rings');
const ahp = require('./ahp');

const DESTRUCTIVE = new Set(['write_file', 'edit_file', 'run_command', 'delete_file', 'move_file', 'apply_patch', 'run_python']);

/**
 * evaluate({ tool, args, context })
 * context: {
 *   readOnly: boolean,
 *   projectRoot: string|false,   // false disables charter lookup
 *   policy: object,              // parsed policy document
 *   charterObj: object,          // pre-loaded charter
 *   sandboxRing: number,         // current privilege ring (default TRUSTED)
 *   toolLog: array,              // for action guard through AHP
 *   agent: string,               // gateway identity
 * }
 * returns { decision: 'allow'|'ask'|'deny', reasons, layers }
 */
function evaluate(input) {
  input = input || {};
  const tool = String(input.tool || '');
  const args = input.args || {};
  const ctx = input.context || {};
  const reasons = [];
  const layers = {};

  if (!tool) return { decision: 'deny', reasons: ['no tool specified'], layers: {} };

  // 1. Read-only boundary
  {
    const r = readOnly.enforce(tool, Boolean(ctx.readOnly));
    layers.readOnly = r.allowed;
    if (!r.allowed) reasons.push(r.reason || ('read-only mode blocks ' + tool));
  }

  // 2. Policy rules (only when a policy document is supplied)
  if (ctx.policy) {
    const p = policy.evaluate(ctx.policy, { tool_name: tool, args });
    layers.policy = p;
    if (!p.allowed) reasons.push('policy blocked: ' + (p.rule || 'rule'));
  }

  // 3. Charter (project-local rules)
  let charterObj = ctx.charterObj || null;
  if (!charterObj && ctx.projectRoot !== false) {
    try { charterObj = charter.load ? charter.load(ctx.projectRoot || process.cwd()) : null; } catch (e) { charterObj = null; }
  }
  if (charterObj) {
    const c = charter.enforce(charterObj, tool, args);
    layers.charter = c;
    if (!c.allowed) reasons.push('charter blocked: ' + (c.reason || 'rule'));
  }

  // 4. Sandbox ring
  {
    const toolRing = rings.ringOf(tool);
    const currentRing = typeof ctx.sandboxRing === 'number' ? ctx.sandboxRing : rings.RINGS.TRUSTED;
    const ok = rings.allowed(currentRing, toolRing);
    layers.sandbox = { current: rings.describe(currentRing), tool: rings.describe(toolRing), allowed: ok };
    if (!ok) reasons.push('sandbox ring ' + rings.describe(currentRing) + ' cannot run ' + tool);
  }

  // 5. AHP unified supervisor (runs the gates again with full context; its
  //    verdict is authoritative when supplied).
  if (ctx.policy || ctx.charterObj || ctx.agent || ctx.actionGuard || ctx.readOnly) {
    try {
      const s = ahp.supervise(tool, args, {
        policy: ctx.policy,
        charterObj,
        agent: ctx.agent,
        actionGuard: ctx.actionGuard,
        readOnly: ctx.readOnly,
        toolLog: ctx.toolLog,
      });
      layers.ahp = s;
      if (!s.allowed && s.blockedBy) reasons.push('AHP blocked at ' + s.blockedBy.gate + ': ' + (s.blockedBy.reason || 'denied'));
    } catch (e) { layers.ahp = { error: String(e.message || e) }; }
  }

  const deny = reasons.some((r) => /block|denied|cannot|forbid/i.test(r));
  let decision = 'allow';
  if (deny) decision = 'deny';
  else if (reasons.length) decision = 'ask';

  return { decision, reasons, layers };
}

function isAllowed(input) { return evaluate(input).decision === 'allow'; }

module.exports = { evaluate, isAllowed, DESTRUCTIVE };
