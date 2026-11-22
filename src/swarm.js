// src/swarm.js
// Multi-agent swarm orchestration: fan a goal out across explicit subtasks,
// each executed through the agent loop, then aggregate subtask results.
const { runAgent } = require('./agent/run');

function toSubtasks(source) {
  const list = Array.isArray(source) ? source : [];
  return list.map((p, i) => {
    const base = typeof p === 'string' ? { id: 'sub-' + (i + 1), prompt: p } : { id: (p && p.id) || 'sub-' + (i + 1), prompt: (p && p.prompt) || '' };
    if (typeof p !== 'string') return { ...base, ...p };
    return base;
  });
}
function isFailed(r) { return !!(r && ((r.final && r.final.type && r.final.type !== 'done') || r.blocked)); }
function resolveRetries(st, perTask) {
  if (st && typeof st.retries === 'number' && st.retries >= 0) return st.retries;
  if (perTask && typeof perTask.retries === 'number' && perTask.retries >= 0) return perTask.retries;
  return 0;
}
function resolveBudget(st, perTask, opts) {
  if (st && typeof st.toolBudget === 'number' && st.toolBudget > 0) return st.toolBudget;
  if (perTask && typeof perTask.toolBudget === 'number' && perTask.toolBudget > 0) return perTask.toolBudget;
  if (opts && typeof opts.toolBudget === 'number' && opts.toolBudget > 0) return opts.toolBudget;
  return undefined;
}
function createSwarmSignal(opts) {
  const external = opts && opts.signal;
  const timeoutMs = (opts && typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0) ? opts.timeoutMs : 0;
  if (!external && !timeoutMs) return { signal: null, cleanup: () => {} };
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else if (typeof external.addEventListener === 'function') external.addEventListener('abort', onAbort, { once: true });
  }
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  if (timer && typeof timer.unref === 'function') timer.unref();
  return { signal: controller.signal, cleanup: () => { if (timer) clearTimeout(timer); if (external && typeof external.removeEventListener === 'function') external.removeEventListener('abort', onAbort); } };
}

async function runSwarm(opts) {
  opts = opts || {};
  const maxW = (typeof opts.maxWaves === 'number' && opts.maxWaves > 0) ? opts.maxWaves : 1;
  const maxConc = (typeof opts.maxConcurrent === 'number' && opts.maxConcurrent > 0) ? opts.maxConcurrent : 1;
  const { signal, cleanup } = createSwarmSignal(opts);
  const subtasks = toSubtasks(opts.plan || opts.subtasks);
  const results = [];
  const queue = [...subtasks];
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length && !(signal && signal.aborted)) {
      const st = queue[cursor++];
      const perTask = opts.perTask || {};
      const retries = resolveRetries(st, perTask);
      const maxAttempts = retries + 1;
      let r = null;
      let attempts = 0;
      const budget = resolveBudget(st, perTask, opts);
      while (attempts < maxAttempts && !(signal && signal.aborted)) {
        attempts++;
        const taskOpts = { model: opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: opts.messages || [{ role: 'user', content: st.prompt || '' }], projectRoot: opts.projectRoot || process.cwd(), autoApprove: true, onEvent: () => {} };
        if (budget !== undefined) taskOpts.tokenBudgetTotal = budget;
        r = await runAgent(taskOpts);
        if (!isFailed(r)) break;
      }
      results.push({ id: st.id, prompt: st.prompt, final: (r && r.final && r.final.final) || '', blocked: !!(r && r.blocked), attempts, toolBudget: budget });
    }
  }
  const workerCount = Math.max(1, Math.min(maxConc, queue.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  cleanup();
  const cancelled = !!(signal && signal.aborted);
  let finalText = results.map((x, i) => '## Subtask ' + (i + 1) + (x.id ? ' (' + x.id + ')' : '') + '\n' + x.final).join('\n\n');
  if (cancelled) finalText += '\n\n(Swarm cancelled before all subtasks completed.)';
  return { final: { type: 'done', final: finalText }, toolLog: [], waves: [], results, cancelled };
}

module.exports = { runSwarm, toSubtasks, isFailed, resolveRetries, resolveBudget, createSwarmSignal };
