// src/hooks.js
// Richer lifecycle hooks with matchers, filters, mutation piping, blocking.
const handlers = {};

function ensure(event) { if (!handlers[event]) handlers[event] = []; return handlers[event]; }

function register(event, fn) {
  // backward-compat: fn is a handler
  ensure(event).push({ matcher: null, filter: null, handler: fn });
}

function on(event, spec) {
  spec = spec || {};
  const h = spec.handler || spec;
  ensure(event).push({ matcher: spec.matcher || null, filter: spec.filter || null, handler: h });
  return () => {
    const arr = handlers[event];
    const idx = arr.indexOf(spec);
    if (idx >= 0) arr.splice(idx, 1);
  };
}

function matchesMatcher(matcher, toolName) {
  if (matcher == null) return true;
  if (typeof matcher === 'string') return matcher === toolName;
  if (matcher instanceof RegExp) { matcher.lastIndex = 0; return matcher.test(toolName); }
  if (typeof matcher === 'function') return !!matcher(toolName);
  return true;
}

async function run(event, ctx) {
  ctx = ctx || {};
  const arr = handlers[event] || [];
  const result = { blocked: false, reason: null, mutatedInput: null, mutatedPrompt: null, mutatedArgs: null };
  let currentInput = ctx.toolInput;
  let currentPrompt = ctx.prompt;
  for (const spec of arr) {
    if (spec.matcher && !matchesMatcher(spec.matcher, ctx.toolName)) continue;
    if (spec.filter && !spec.filter(ctx)) continue;
    try {
      const r = await spec.handler(Object.assign({}, ctx, { toolInput: currentInput, prompt: currentPrompt }), ctx);
      if (r && r.mutatedInput) { currentInput = r.mutatedInput; result.mutatedInput = currentInput; result.mutatedArgs = currentInput; }
      if (r && r.mutatedArgs) { currentInput = r.mutatedArgs; result.mutatedArgs = currentInput; result.mutatedInput = currentInput; }
      if (r && r.mutatedPrompt) { currentPrompt = r.mutatedPrompt; result.mutatedPrompt = currentPrompt; }
      if (r && (r.block === true || (typeof r.block === 'string' && r.block))) {
        result.blocked = true;
        result.reason = (typeof r.block === 'string') ? r.block : 'blocked';
        break;
      }
      if (r && r.reject === true) { result.blocked = true; result.reason = (typeof r.reject === 'string') ? r.reject : 'rejected'; break; }
    } catch (e) {
      // log and continue
    }
  }
  result.finalInput = currentInput;
  result.finalPrompt = currentPrompt;
  return result;
}

function list() { return Object.keys(handlers).map((k) => ({ event: k, count: (handlers[k] || []).length })); }

module.exports = { register, on, run, list, handlers };
