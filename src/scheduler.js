// src/scheduler.js
// Scheduled agents: cron expressions → timers → agent run → outbox delivery.
const alwayson = require('./alwayson');

function parseCron(expr) {
  const parts = (expr || '').trim().split(/\s+/);
  if (parts.length !== 5) throw new Error('cron must have 5 fields: minute hour dom month dow');
  return parts.map((p) => p.split(','));
}

function fieldMatches(field, value) {
  for (const part of field) {
    if (part === '*') return true;
    if (part.startsWith('*/')) { const n = Number(part.slice(2)); if (n && value % n === 0) return true; continue; }
    if (String(value) === part) return true;
    if (part.includes('-')) { const [a, b] = part.split('-').map(Number); if (value >= a && value <= b) return true; }
  }
  return false;
}

function matches(cronFields, date) {
  return fieldMatches(cronFields[0], date.getMinutes()) &&
    fieldMatches(cronFields[1], date.getHours()) &&
    fieldMatches(cronFields[2], date.getDate()) &&
    fieldMatches(cronFields[3], date.getMonth() + 1) &&
    fieldMatches(cronFields[4], date.getDay());
}

function nextRun(expr, from) {
  const fields = parseCron(expr);
  let d = new Date((from || Date.now()) + 60000);
  d.setSeconds(0, 0);
  for (let i = 0; i < 60 * 24 * 366; i++) {
    if (matches(fields, d)) return d.getTime();
    d = new Date(d.getTime() + 60000);
  }
  return null;
}

function schedule(name, expr, prompt, opts) {
  opts = opts || {};
  const due = nextRun(expr);
  if (!due) throw new Error('no next run found');
  const id = alwayson.scheduleTimer(due - Date.now(), { kind: 'scheduled_agent', name, cron: expr, prompt, delivery: opts.delivery || 'outbox' });
  return { id, nextRun: new Date(due).toISOString(), cron: expr };
}

async function tick(opts) {
  opts = opts || {};
  const due = alwayson.dueTimers().filter((t) => {
    try { return JSON.parse(t.payload).kind === 'scheduled_agent'; } catch (e) { return false; }
  });
  const fired = [];
  for (const t of due) {
    const p = JSON.parse(t.payload);
    alwayson.fireTimer(t.id);
    let output = '';
    try {
      const { runAgent } = require('./agent/run');
      const r = await runAgent({ model: p.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: p.prompt }], projectRoot: opts.projectRoot || process.cwd(), autoApprove: true, onEvent: () => {} });
      output = (r.final && r.final.final) || '';
    } catch (e) { output = 'error: ' + String(e.message || e); }
    alwayson.outbox({ name: p.name, output, delivery: p.delivery, at: new Date().toISOString() });
    // reschedule
    try { schedule(p.name, p.cron, p.prompt, { delivery: p.delivery }); } catch (e) {}
    fired.push({ id: t.id, name: p.name, output: output.slice(0, 200) });
  }
  return { fired };
}

function list() {
  return alwayson.events('pending').filter((e) => { try { return JSON.parse(e.payload).kind === 'scheduled_agent'; } catch (err) { return false; } });
}

module.exports = { parseCron, matches, nextRun, schedule, tick, list };
