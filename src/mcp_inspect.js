// src/mcp_inspect.js
// Deterministic MCP server tests (inspector-style).
// Runs schema/behaviour checks against an MCP server's dispatch function.
const REQUIRED_TOOL_FIELDS = ['name', 'description', 'inputSchema'];

function checkTools(tools) {
  const checks = [];
  const seen = new Set();
  for (const t of tools || []) {
    const name = t.name || (t.function && t.function.name) || '<unnamed>';
    const desc = t.description || (t.function && t.function.description) || '';
    const schema = t.inputSchema || (t.function && t.function.parameters);
    const problems = [];
    if (!t.name && !(t.function && t.function.name)) problems.push('missing name');
    if (!desc) problems.push('missing description');
    if (!schema) problems.push('missing inputSchema');
    else if (schema.type !== 'object') problems.push('inputSchema.type should be "object"');
    if (seen.has(name)) problems.push('duplicate name');
    seen.add(name);
    checks.push({ kind: 'tool', name, ok: problems.length === 0, problems });
  }
  return checks;
}

function checkResources(resources) {
  return (resources || []).map((r) => {
    const problems = [];
    if (!r.uri) problems.push('missing uri');
    if (!r.name) problems.push('missing name');
    if (r.uri && !/^[a-z][a-z0-9+.-]*:/i.test(r.uri)) problems.push('uri is not a valid scheme');
    return { kind: 'resource', name: r.name || r.uri || '<unnamed>', ok: problems.length === 0, problems };
  });
}

function checkPrompts(prompts) {
  return (prompts || []).map((p) => {
    const problems = [];
    if (!p.name) problems.push('missing name');
    if (p.arguments && !Array.isArray(p.arguments)) problems.push('arguments should be an array');
    return { kind: 'prompt', name: p.name || '<unnamed>', ok: problems.length === 0, problems };
  });
}

async function checkDispatch(dispatch, opts) {
  opts = opts || {};
  const checks = [];
  const expect = async (label, msg, predicate) => {
    const started = Date.now();
    let result;
    let error = null;
    try { result = await dispatch(msg); } catch (e) { error = String((e && e.message) || e); }
    const ok = !error && (predicate ? predicate(result) : true);
    checks.push({ kind: 'dispatch', name: label, ok, error, duration: Date.now() - started });
    return result;
  };
  await expect('initialize returns serverInfo', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'aegisai-inspect' } } },
    (r) => Boolean(r && r.result && r.result.serverInfo));
  await expect('tools/list returns array', { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    (r) => Boolean(r && r.result && Array.isArray(r.result.tools)));
  await expect('unknown method errors cleanly', { jsonrpc: '2.0', id: 3, method: 'nope/not-a-method' },
    (r) => Boolean(r && (r.error || (r.result === null))));
  const timeoutMs = opts.timeoutMs || 5000;
  const started = Date.now();
  let slow = false;
  try {
    await Promise.race([
      dispatch({ jsonrpc: '2.0', id: 4, method: 'tools/list' }),
      new Promise((_, rej) => setTimeout(() => { slow = true; rej(new Error('timeout')); }, timeoutMs)),
    ]);
  } catch (e) { /* recorded below */ }
  checks.push({ kind: 'dispatch', name: 'responds within ' + timeoutMs + 'ms', ok: !slow, duration: Date.now() - started });
  return checks;
}

function summarize(checks) {
  const failed = checks.filter((c) => !c.ok);
  return {
    total: checks.length,
    passed: checks.length - failed.length,
    failed: failed.length,
    failures: failed,
    verdict: failed.length ? 'fail' : 'pass',
  };
}

async function inspect(server, opts) {
  const s = server || {};
  const checks = [];
  if (typeof s.toolsList === 'function') checks.push(...checkTools(await s.toolsList()));
  if (typeof s.resourcesList === 'function') checks.push(...checkResources(await s.resourcesList()));
  if (typeof s.promptsList === 'function') checks.push(...checkPrompts(await s.promptsList()));
  if (typeof s.dispatch === 'function') checks.push(...await checkDispatch(s.dispatch, opts));
  return { checks, summary: summarize(checks) };
}

module.exports = { inspect, checkTools, checkResources, checkPrompts, checkDispatch, summarize, REQUIRED_TOOL_FIELDS };
