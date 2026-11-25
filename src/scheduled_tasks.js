// src/scheduled_tasks.js
// Cron-based scheduled agent runs.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const { runAgent } = require('./agent/run');

const jobs = new Map();
let nextId = 1;

function dir() { return path.join(DATA_DIR, 'schedules'); }
function ensureDir() { fs.mkdirSync(dir(), { recursive: true }); }

function parseCron(expr) {
  const str = (expr || '').trim();
  // "every 5m", "every 5 m", "every 1h", etc.
  const m = str.match(/^every\s+(\d+)\s*([mh])$/i);
  if (m) {
    const n = parseInt(m[1], 10);
    return { type: 'interval', ms: m[2].toLowerCase() === 'h' ? n * 3600000 : n * 60000 };
  }
  const parts = str.split(/\s+/);
  if (parts.length === 2 && parts[0].toLowerCase() === 'daily') {
    const [h, m2] = parts[1].split(':').map(Number);
    return { type: 'daily', hour: h || 0, minute: m2 || 0 };
  }
  // Standard 5-field cron
  if (parts.length === 5) {
    return { type: 'cron', fields: parts };
  }
  return null;
}

function nextRun(schedule) {
  const now = new Date();
  if (schedule.type === 'interval') return now.getTime() + schedule.ms;
  if (schedule.type === 'daily') {
    const next = new Date(now);
    next.setHours(schedule.hour, schedule.minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime();
  }
  if (schedule.type === 'cron') {
    // Basic: parse minute and hour fields (support */n and specific values).
    const minuteField = schedule.fields[0];
    const hourField = schedule.fields[1];
    const next = new Date(now);
    next.setSeconds(0, 0);
    // Try to set minute.
    let minute = now.getMinutes() + 1;
    if (minuteField !== '*') {
      const m = parseInt(minuteField, 10);
      if (!isNaN(m)) minute = m;
    }
    next.setMinutes(minute);
    if (hourField !== '*') {
      const h = parseInt(hourField, 10);
      if (!isNaN(h)) next.setHours(h);
    }
    if (next <= now) next.setMinutes(next.getMinutes() + 1);
    return next.getTime();
  }
  return now.getTime() + 60000;
}

function create(opts) {
  ensureDir();
  const id = 'sched_' + (nextId++);
  const schedule = parseCron(opts.cron || 'every 5m');
  if (!schedule) throw new Error('invalid cron expression');
  const job = {
    id,
    name: opts.name || id,
    cron: opts.cron || 'every 5m',
    schedule,
    prompt: opts.prompt || 'Run scheduled task',
    model: opts.model,
    enabled: opts.enabled !== false,
    nextRun: nextRun(schedule),
    lastRun: null,
    lastResult: null,
    runCount: 0,
  };
  jobs.set(id, job);
  // Persist
  try { fs.writeFileSync(path.join(dir(), id + '.json'), JSON.stringify(job, null, 2)); } catch (e) {}
  return job;
}

function list() {
  return Array.from(jobs.values());
}

function get(id) { return jobs.get(id) || null; }

function remove(id) {
  const job = jobs.get(id);
  if (!job) return { ok: false, error: 'not found' };
  if (job.timer) clearInterval(job.timer);
  jobs.delete(id);
  try { fs.unlinkSync(path.join(dir(), id + '.json')); } catch (e) {}
  return { ok: true, id };
}

function toggle(id, enabled) {
  const job = jobs.get(id);
  if (!job) return { ok: false, error: 'not found' };
  job.enabled = enabled;
  try { fs.writeFileSync(path.join(dir(), id + '.json'), JSON.stringify(job, null, 2)); } catch (e) {}
  return { ok: true, id, enabled };
}

async function runJob(id) {
  const job = jobs.get(id);
  if (!job || !job.enabled) return;
  job.lastRun = new Date().toISOString();
  job.runCount++;
  try {
    const r = await runAgent({
      model: job.model || process.env.AEGISAI_MODEL || 'llama3.2:3b',
      messages: [{ role: 'user', content: job.prompt }],
      projectRoot: process.cwd(),
      autoApprove: false,
      onEvent: () => {},
    });
    job.lastResult = (r.final && r.final.final) || '';
  } catch (e) {
    job.lastResult = 'Error: ' + (e.message || e);
  }
  job.nextRun = nextRun(job.schedule);
  try { fs.writeFileSync(path.join(dir(), id + '.json'), JSON.stringify(job, null, 2)); } catch (e) {}
  return job;
}

function startScheduler() {
  // Check every minute for due jobs.
  setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (job.enabled && job.nextRun <= now) {
        runJob(id).catch(() => {});
      }
    }
  }, 60000);
}

// Load persisted jobs on startup.
function loadJobs() {
  ensureDir();
  try {
    for (const f of fs.readdirSync(dir())) {
      if (!f.endsWith('.json')) continue;
      try {
        const job = JSON.parse(fs.readFileSync(path.join(dir(), f), 'utf8'));
        if (job && job.id) {
          job.nextRun = nextRun(job.schedule);
          jobs.set(job.id, job);
          if (parseInt(job.id.split('_')[1], 10) >= nextId) nextId = parseInt(job.id.split('_')[1], 10) + 1;
        }
      } catch (e) {}
    }
  } catch (e) {}
}

loadJobs();

module.exports = { create, list, get, remove, toggle, runJob, startScheduler, parseCron };