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

function expandCronField(field, min, max, names) {
  const out = new Set();
  const parts = String(field || '*').split(',');
  for (const part of parts) {
    let p = part.trim();
    if (!p) continue;
    // handle names
    if (names && /[a-zA-Z]/.test(p) && !p.includes('/') && !p.includes('-')) {
      const v = names[p.toLowerCase()];
      if (v !== undefined) { out.add(v); continue; }
    }
    // step
    let step = 1;
    if (p.includes('/')) {
      const [range, st] = p.split('/');
      step = parseInt(st, 10) || 1;
      p = range;
    }
    let start = min, end = max;
    if (p !== '*') {
      if (p.includes('-')) {
        const [a, b] = p.split('-');
        const av = names && /[a-zA-Z]/.test(a) ? names[a.toLowerCase()] : parseInt(a, 10);
        const bv = names && /[a-zA-Z]/.test(b) ? names[b.toLowerCase()] : parseInt(b, 10);
        start = isNaN(av) ? min : av;
        end = isNaN(bv) ? max : bv;
      } else {
        const v = names && /[a-zA-Z]/.test(p) ? names[p.toLowerCase()] : parseInt(p, 10);
        if (isNaN(v)) { /* wildcard */ start = min; end = max; }
        else { start = v; end = v; }
      }
    }
    if (start > end) { /* wrap? */ }
    for (let v = start; v <= end; v += step) {
      if (v >= min && v <= max) out.add(v);
    }
    // handle */step already start=min
  }
  if (out.size === 0) {
    for (let v = min; v <= max; v++) out.add(v);
  }
  return out;
}

function nextRun(schedule, now) {
  const nowDate = now ? new Date(now) : new Date();
  if (schedule.type === 'interval') return nowDate.getTime() + schedule.ms;
  if (schedule.type === 'daily') {
    const next = new Date(nowDate);
    next.setHours(schedule.hour, schedule.minute, 0, 0);
    if (next <= nowDate) next.setDate(next.getDate() + 1);
    return next.getTime();
  }
  if (schedule.type === 'cron') {
    const fields = schedule.fields;
    const minuteSet = expandCronField(fields[0], 0, 59);
    const hourSet = expandCronField(fields[1], 0, 23);
    const domSet = expandCronField(fields[2], 1, 31);
    const monthSet = expandCronField(fields[3], 1, 12, { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 });
    const dowSet = expandCronField(fields[4], 0, 7, { sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6 });
    const domRestricted = fields[2] !== '*';
    const dowRestricted = fields[4] !== '*';
    const limit = new Date(nowDate.getTime());
    limit.setFullYear(limit.getFullYear() + 5);
    const t = new Date(nowDate.getTime());
    t.setSeconds(0, 0);
    t.setMilliseconds(0);
    t.setMinutes(t.getMinutes() + 1);
    while (t.getTime() <= limit.getTime()) {
      const min = t.getMinutes();
      const hr = t.getHours();
      const dom = t.getDate();
      const mon = t.getMonth() + 1;
      const dow = t.getDay(); // 0 Sun
      // Simpler re-check:
      let dayOk;
      if (domRestricted && dowRestricted) dayOk = domSet.has(dom) || dowSet.has(dow) || dowSet.has(dow === 0 ? 7 : dow);
      else if (domRestricted) dayOk = domSet.has(dom);
      else if (dowRestricted) dayOk = dowSet.has(dow) || dowSet.has(dow === 0 ? 7 : dow);
      else dayOk = true;
      if (minuteSet.has(min) && hourSet.has(hr) && monthSet.has(mon) && dayOk) {
        return t.getTime();
      }
      t.setMinutes(t.getMinutes() + 1);
    }
    return nowDate.getTime() + 60000;
  }
  return nowDate.getTime() + 60000;
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

let _schedulerHandle = null;
const _runningJobs = new Set();

function startScheduler() {
  if (_schedulerHandle) return;
  _schedulerHandle = setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (job.enabled && job.nextRun <= now && !_runningJobs.has(id)) {
        _runningJobs.add(id);
        runJob(id).finally(() => _runningJobs.delete(id)).catch(() => {});
      }
    }
  }, 60000);
}

function stopScheduler() {
  if (_schedulerHandle) { clearInterval(_schedulerHandle); _schedulerHandle = null; }
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

module.exports = { create, list, get, remove, toggle, runJob, startScheduler, parseCron, nextRun };