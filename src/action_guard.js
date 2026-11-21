// src/action_guard.js
// Evidence-based action guardrails: gate consequential actions on observed evidence.
const RULES = [
  {
    name: 'no-blind-write',
    tools: ['write_file', 'delete_file'],
    check: (args, ctx) => {
      const path = args.path || args.file_path || '';
      const read = (ctx.toolLog || []).some((t) => t.name === 'read_file' && (t.args?.path === path || t.args?.file_path === path));
      if (read) return { allowed: true, evidence: 'prior read of ' + path };
      return { allowed: false, reason: 'no evidence of prior read for ' + path + ' (enable approval or read first)' };
    },
  },
  {
    name: 'no-unverified-done',
    tools: ['__final__'],
    check: (args, ctx) => {
      if (ctx.verified) return { allowed: true, evidence: 'verified' };
      return { allowed: false, reason: 'final claim not verified' };
    },
  },
];

function gate(toolName, args, ctx) {
  ctx = ctx || {};
  for (const r of RULES) {
    if (!r.tools.includes(toolName)) continue;
    const v = r.check(args || {}, ctx);
    return Object.assign({ rule: r.name }, v);
  }
  return { allowed: true };
}

module.exports = { RULES, gate };
