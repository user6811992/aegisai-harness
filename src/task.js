// src/task.js
// Long-horizon task orchestration: goal -> plan -> execute -> verify -> deliver.
const { runAgent } = require('./agent/run');

const TASK_PHASES = ['plan', 'execute', 'verify', 'deliver'];
const TASK_STEP_URL_KEYS = ['url', 'target', 'endpoint', 'href', 'link'];
const TASK_CTX_URL_KEYS = ['url', 'target', 'endpoint', 'href'];

function taskPhasePrompt(phase, ctx) {
  const goal = (ctx && ctx.goal) || 'the task';
  switch (phase) {
    case 'plan': return 'TASK_PHASE=plan. You are planning task: ' + goal + '. Produce a structured, ordered plan with explicit steps and acceptance criteria.';
    case 'execute': return 'TASK_PHASE=execute. You are executing task plan for: ' + goal + '. Work through each plan step using available tools; record partial results.';
    case 'verify': return 'TASK_PHASE=verify. You are verifying task: ' + goal + '. Run validation / checks and confirm the task objective is met before delivery.';
    case 'deliver': return 'TASK_PHASE=deliver. You are delivering task: ' + goal + '. Produce the final delivery report with outcome and evidence.';
    case 'decompose': return 'TASK_PHASE=decompose. You are decomposing task: ' + goal + ' into concrete subtasks. Output a numbered list of subtask goals, each independently actionable.';
    default: return 'TASK_PHASE=' + phase + '. Work on task: ' + goal + '.';
  }
}
function sandboxTaskContext(ctx) {
  const c = ctx || {};
  const urlValidate = require('./url_validate');
  for (const k of TASK_CTX_URL_KEYS) {
    const v = c[k];
    if (typeof v === 'string' && v.trim() && !urlValidate.validate(v).ok) return { ok: false, blocked: true, reason: 'unsafe task context target blocked by sandbox: ' + k };
  }
  return { ok: true, blocked: false };
}
function sandboxTaskStep(step) {
  const s = step || {};
  const name = String(s.name || '');
  const args = s.args || {};
  const urlValidate = require('./url_validate');
  for (const k of TASK_STEP_URL_KEYS) {
    const v = args[k];
    if (typeof v === 'string' && v.trim() && !urlValidate.validate(v).ok) return { ok: false, blocked: true, tool: name, reason: 'unsafe url blocked by task sandbox: ' + k };
  }
  return { ok: true, blocked: false, tool: name };
}
async function runTask(opts) {
  opts = opts || {};
  const maxWaves = (typeof opts.maxWaves === 'number' && opts.maxWaves > 0) ? opts.maxWaves : 4;
  const blockedCtx = sandboxTaskContext(opts.taskCtx || {});
  if (blockedCtx.blocked) return { final: { type: 'done', final: 'sandbox blocked: ' + blockedCtx.reason }, toolLog: [], waves: [], blocked: true };
  const phases = opts.phases || TASK_PHASES;
  const results = [];
  let messages = opts.messages || [{ role: 'user', content: taskPhasePrompt('plan', { goal: opts.goal }) }];
  for (const phase of phases) {
    const r = await runAgent({ model: opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages, projectRoot: opts.projectRoot || process.cwd(), autoApprove: true, onEvent: () => {} });
    results.push({ phase, final: (r.final && r.final.final) || '' });
    messages = [{ role: 'user', content: taskPhasePrompt(phase === 'plan' ? 'execute' : phase === 'execute' ? 'verify' : 'deliver', { goal: opts.goal }) + '\n\nPrevious: ' + ((r.final && r.final.final) || '').slice(0, 2000) }];
  }
  return { final: { type: 'done', final: results.map((r) => '## ' + r.phase + '\n' + r.final).join('\n\n') }, toolLog: [], waves: phases, results };
}

module.exports = { runTask, TASK_PHASES, taskPhasePrompt, TASK_STEP_URL_KEYS, TASK_CTX_URL_KEYS, sandboxTaskContext, sandboxTaskStep };
