// src/network_checks.js
// Declarative network condition assertions — clean-room hardbyte/netchecks
// (166⭐) idea. Assert that network/backend conditions are as expected.
function compare(actual, rule) {
  const op = rule.op || 'eq';
  const expected = rule.expected;
  switch (op) {
    case 'eq': return actual === expected;
    case 'neq': return actual !== expected;
    case 'gt': return Number(actual) > Number(expected);
    case 'gte': return Number(actual) >= Number(expected);
    case 'lt': return Number(actual) < Number(expected);
    case 'lte': return Number(actual) <= Number(expected);
    case 'contains': return String(actual).includes(String(expected));
    case 'regex': return new RegExp(expected).test(String(actual));
    default: return false;
  }
}

function check(conditions, opts) {
  const results = (conditions || []).map((c) => {
    const actual = c.actual != null ? c.actual : (opts && opts.values && opts.values[c.name]);
    const pass = compare(actual, c);
    return { name: c.name || 'unnamed', op: c.op || 'eq', expected: c.expected, actual, pass };
  });
  return { ok: true, pass: results.every((r) => r.pass), results };
}

async function probe(checks, opts) {
  // Optional live HTTP checks; network-dependent and disabled offline.
  if (process.env.AEGISAI_OFFLINE === 'true') return { ok: false, error: 'network checks disabled in offline mode' };
  const out = [];
  for (const c of checks || []) {
    if (!c.url) { out.push({ name: c.name, skipped: true, reason: 'no url' }); continue; }
    try {
      const r = await fetch(c.url, { signal: AbortSignal.timeout((opts && opts.timeoutMs) || 5000) });
      const actual = c.metric === 'status' ? r.status : (c.metric === 'content-type' ? r.headers.get('content-type') : r.status);
      out.push({ name: c.name || c.url, actual, pass: c.expected != null ? compare(actual, c) : r.ok, url: c.url });
    } catch (e) { out.push({ name: c.name || c.url, error: String(e.message || e), pass: false }); }
  }
  return { ok: true, pass: out.every((r) => r.pass), results: out };
}

function tools() {
  return [
    { name: 'netcheck_assert', description: 'Assert network/backend conditions against expected values.', inputSchema: { type: 'object', properties: { conditions: { type: 'array' } }, required: ['conditions'] } },
    { name: 'netcheck_probe', description: 'Live HTTP condition checks (network, opt-in).', inputSchema: { type: 'object', properties: { checks: { type: 'array' } } } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'netcheck_assert') return check(args.conditions, args);
  if (name === 'netcheck_probe') return probe(args.checks, args);
  throw new Error('unknown netcheck tool: ' + name);
}
module.exports = { compare, check, probe, tools, dispatch };
