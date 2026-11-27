// src/tool_guardrails.js
// Reliability layer for LLM tool calls — clean-room adaptation of forge ideas
// (antoinezambelli/forge, MIT). Rescue malformed calls, nudge retries,
// validate responses, and enforce optional workflow constraints.
// Local-only, no network. Opt-in: pass guardrails to runAgent().

// ---- Rescue parsing: repair malformed tool calls from weak local models ----

function rescueParse(tc) {
  const fn = tc && (tc.function || tc) || {};
  const name = typeof fn.name === 'string' ? fn.name.trim() : '';
  let args = fn.arguments;
  let rescued = false;
  const notes = [];
  if (typeof args === 'string') {
    const trimmed = args.trim();
    try { args = JSON.parse(trimmed); }
    catch (e) {
      rescued = true;
      // 1) strip common wrappers (```json ... ```)
      let s = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      // 2) strip leading prose before first { or [
      const first = s.search(/[\[{]/);
      if (first > 0) s = s.slice(first);
      // 3) balance braces/quotes for truncated JSON
      const opened = (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
      const brackets = (s.match(/\[/g) || []).length - (s.match(/\]/g) || []).length;
      if (opened > 0) s += '}'.repeat(opened);
      if (brackets > 0) s += ']'.repeat(brackets);
      const oddQuotes = (s.match(/(?<!\\)"/g) || []).length % 2;
      if (oddQuotes) s += '"';
      try { args = JSON.parse(s); notes.push('repaired truncated/wrapped JSON'); }
      catch (e2) {
        // 4) extract key="value" pairs as a last resort
        const obj = {};
        const re = /([\w-]+)\s*[:=]\s*("(?:[^"\\]|\\.)*"|'[^']*'|[\w.\-/]+|true|false|null)/g;
        let m;
        while ((m = re.exec(s))) {
          let v = m[2];
          if (/^".*"$/.test(v)) { try { v = JSON.parse(v); } catch (e3) {} }
          else if (/^'.*'$/.test(v)) v = v.slice(1, -1);
          else if (v === 'true') v = true;
          else if (v === 'false') v = false;
          else if (v === 'null') v = null;
          else if (/^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
          obj[m[1]] = v;
        }
        if (Object.keys(obj).length) { args = obj; notes.push('extracted key=value pairs'); }
        else { args = {}; notes.push('argument parse failed; using empty object'); }
      }
    }
  }
  if (args == null || typeof args !== 'object') { args = {}; rescued = true; notes.push('non-object args coerced'); }
  return { name, args, rescued, notes, id: tc && tc.id };
}

// ---- Response validation: detect empty/garbled tool results ----

function validateResponse(name, result) {
  const issues = [];
  if (!result) issues.push('null result');
  else if (typeof result === 'object') {
    if (result.ok === false && !result.output && !result.error) issues.push('failed without diagnostic');
    if (result.output === '' || result.output == null) issues.push('empty output');
    if (typeof result.output === 'string' && /^undefined$|^null$|^\[object Object\]$/i.test(result.output.trim())) issues.push('placeholder output');
  } else if (typeof result === 'string') {
    if (!result.trim()) issues.push('empty string');
  }
  return { valid: issues.length === 0, issues };
}

// ---- Retry nudges: suggest a corrective message after a failed tool call ----

function nudge(name, args, result, opts) {
  opts = opts || {};
  const v = validateResponse(name, result);
  if (v.valid) return null;
  const hints = [];
  if (v.issues.includes('empty output')) hints.push('check the path and permissions');
  if (v.issues.includes('failed without diagnostic')) hints.push('report the actual error');
  if (v.issues.includes('placeholder output')) hints.push('return the real content');
  return {
    role: 'user',
    content: `[tool-nudge] The "${name}" call returned ${v.issues.join(', ')}. ${hints.join('; ') || 'Retry with corrected arguments.'} Only retry if the task still requires it.`,
    tool: name,
    issues: v.issues,
  };
}

// ---- Workflow constraints (opt-in) ----

function checkWorkflow(toolLog, workflow) {
  if (!workflow) return { allowed: true, issues: [] };
  const called = new Set((toolLog || []).map((t) => t.name));
  const issues = [];
  for (const step of workflow.required_steps || []) {
    if (!called.has(step)) issues.push('required step not run: ' + step);
  }
  for (const [tool, prereqs] of Object.entries(workflow.prerequisites || {})) {
    if (called.has(tool)) {
      for (const p of (Array.isArray(prereqs) ? prereqs : [prereqs])) {
        if (!called.has(p)) issues.push(`${tool} requires prior ${p}`);
      }
    }
  }
  return { allowed: issues.length === 0, issues };
}

// ---- Core guard: apply to a parsed tool call before execution ----

function guardToolCall(tc, opts) {
  opts = opts || {};
  const r = rescueParse(tc);
  const issues = [];
  if (!r.name) issues.push('missing tool name');
  if (opts.allowedTools && !opts.allowedTools.includes(r.name)) issues.push('tool not allowed: ' + r.name);
  if (opts.deniedTools && opts.deniedTools.includes(r.name)) issues.push('tool denied: ' + r.name);
  return Object.assign({}, r, { ok: issues.length === 0, issues });
}

// ---- MCP surface ----

function tools() {
  return [
    { name: 'tool_guard_rescue', description: 'Rescue-parse a malformed tool call (repair JSON, extract arguments).', inputSchema: { type: 'object', properties: { toolCall: { type: 'object' } } } },
    { name: 'tool_guard_validate', description: 'Validate a tool response for empty/placeholder output.', inputSchema: { type: 'object', properties: { name: { type: 'string' } } } },
    { name: 'tool_guard_workflow', description: 'Check required/prerequisite steps against a tool log.', inputSchema: { type: 'object', properties: { workflow: { type: 'object' } } } },
  ];
}

function dispatch(name, args) {
  args = args || {};
  if (name === 'tool_guard_rescue') return guardToolCall(args.toolCall, args);
  if (name === 'tool_guard_validate') return validateResponse(args.name, args.result);
  if (name === 'tool_guard_workflow') return checkWorkflow(args.toolLog, args.workflow);
  throw new Error('unknown tool_guardrails tool: ' + name);
}

module.exports = {
  rescueParse, validateResponse, nudge, checkWorkflow, guardToolCall, tools, dispatch,
};
