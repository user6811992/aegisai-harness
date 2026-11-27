// src/proxy_guardrails.js
// OpenAI-compatible proxy guardrails — clean-room forge + IK-LLama-Proxy ideas.
// Wraps tool calls and final claims with reliability checks (rescue parsing,
// retry nudges, evidence-gated completion) in proxy mode. No new tools.
const guards = require('./tool_guardrails');

function processRequest(req, opts) {
  opts = opts || {};
  const calls = (req && req.tool_calls) || [];
  const rescued = calls.map((tc) => {
    const g = guards.guardToolCall(tc, opts);
    if (g.rescued) return { ...tc, function: { ...(tc.function||tc), arguments: JSON.stringify(g.args) }, rescued: true, notes: g.notes };
    return tc;
  });
  return { ok: true, request: { ...req, tool_calls: rescued }, rescued: rescued.filter(c=>c.rescued).length };
}

function processResponse(res, toolLog, opts) {
  const final = (res && res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content) || '';
  const v = require('./verifier').verify(final, toolLog||[]);
  const nudges = [];
  for (const r of (toolLog||[])) {
    if (r.result && r.result.ok === false) {
      const n = guards.nudge(r.name, r.args, r.result, opts||{});
      if (n) nudges.push(n);
    }
  }
  return { ok: true, verified: v.verified, issues: v.issues, nudges, note: 'proxy applies guardrails transparently' };
}

function tools() {
  return [{ name: 'proxy_guarded_request', description: 'Rescue-parse tool calls in an OpenAI-compatible request.', inputSchema: { type: 'object', properties: { request: { type: 'object' } }, required: ['request'] } }];
}
function dispatch(name,args){args=args||{};if(name==='proxy_guarded_request')return processRequest(args.request,args);if(name==='proxy_guarded_response')return processResponse(args.response,args.toolLog,args);throw new Error('unknown proxy_guardrails tool: '+name);}
module.exports = { processRequest, processResponse, tools, dispatch };
