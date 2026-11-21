// src/async_tools.js
// Simplified background/async tool lifecycle + universal task tool.
const { EventEmitter } = require('events');

class BackgroundPool {
  constructor() {
    this.tasks = new Map();
    this.counter = 0;
  }
  run(toolName, fn, graceMs) {
    graceMs = graceMs || 250;
    const id = 'task_' + (++this.counter);
    const task = { id, toolName, status: 'working', log: [], result: null, error: null, settled: false, started: Date.now() };
    this.tasks.set(id, task);
    const promise = (async () => {
      try {
        const r = await fn((msg) => { task.log.push(msg); });
        task.result = r;
        task.status = 'completed';
      } catch (e) {
        task.error = String(e.message || e);
        task.status = 'failed';
      } finally {
        task.settled = true;
      }
    })();
    // grace window
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve({ taskId: id, pending: true, task });
      }, graceMs);
      promise.then(() => {
        clearTimeout(timer);
        if (task.settled && task.status === 'completed') {
          resolve({ taskId: id, pending: false, result: task.result, task });
        }
      });
    });
  }
  get(id) { return this.tasks.get(id); }
  status(id) {
    const t = this.tasks.get(id);
    if (!t) return null;
    return { id: t.id, status: t.status, elapsed: Date.now() - t.started, logTail: t.log.slice(-5), result: t.settled ? t.result : null, error: t.error };
  }
  cancel(id) {
    const t = this.tasks.get(id);
    if (t) { t.status = 'cancelled'; t.settled = true; }
  }
}

const TASK_TOOL_DEF = {
  type: 'function',
  function: {
    name: 'task',
    description: 'Check status/result of a background task.',
    parameters: { type: 'object', properties: { taskId: { type: 'string' }, view: { type: 'string', enum: ['status', 'logs', 'result'] }, tail: { type: 'number' } }, required: ['taskId'] },
  },
};

function handleTask(pool, args) {
  const t = pool.get(args.taskId);
  if (!t) return { ok: false, output: 'unknown task: ' + args.taskId };
  const view = args.view || 'status';
  if (view === 'logs') return { ok: true, output: JSON.stringify(t.log.slice(-(args.tail || 10))) };
  if (view === 'result') return t.settled ? { ok: t.status === 'completed', output: JSON.stringify(t.result) } : { ok: false, output: 'not settled: ' + t.status };
  return { ok: true, output: JSON.stringify({ id: t.id, status: t.status, elapsed: Date.now() - t.started, logTail: t.log.slice(-3) }) };
}

module.exports = { BackgroundPool, TASK_TOOL_DEF, handleTask };