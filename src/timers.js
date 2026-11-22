// src/timers.js
// Interval/one-shot triggers that enqueue jobs into an always-on session (aegisai-next server/runtime/timers.js).
const DEFAULT_POLL_MS = 1000;

function createTimerScheduler(opts) {
  opts = opts || {};
  let enqueue = typeof opts.enqueue === 'function' ? opts.enqueue : () => null;
  const timers = new Map();
  let seq = 0;
  function stop(timer) { if (timer.handle) { clearInterval(timer.handle); timer.handle = null; } timer.active = false; }
  function schedule(sessionId, job, options) {
    options = options || {};
    const everyMs = (typeof options.everyMs === 'number' && options.everyMs > 0) ? options.everyMs : DEFAULT_POLL_MS;
    const maxRuns = (typeof options.maxRuns === 'number' && options.maxRuns > 0) ? Math.floor(options.maxRuns) : null;
    const once = !!options.once;
    const timer = { id: options.id || ('tmr-' + Date.now().toString(36) + '-' + (++seq)), sessionId, job: Object.assign({}, job || {}), everyMs, maxRuns, once, runs: 0, active: true, inFlight: false, handle: null };
    timers.set(timer.id, timer);
    timer.handle = setInterval(async () => {
      if (!timer.active || timer.inFlight) return;
      if (timer.maxRuns !== null && timer.runs >= timer.maxRuns) { stop(timer); return; }
      timer.inFlight = true;
      try { await enqueue(timer.sessionId, Object.assign({}, timer.job, { scheduledBy: timer.id })); timer.runs++; if (once || (timer.maxRuns !== null && timer.runs >= timer.maxRuns)) stop(timer); }
      catch (e) { /* leave active */ }
      finally { timer.inFlight = false; }
    }, everyMs);
    if (typeof timer.handle.unref === 'function') timer.handle.unref();
    return timer;
  }
  function cancel(timerId) { const timer = timers.get(timerId); if (!timer) return false; stop(timer); return true; }
  function cancelSession(sessionId) { let n = 0; for (const t of timers.values()) { if (t.sessionId === sessionId && t.active) { stop(t); n++; } } return n; }
  function list(sessionId) { const all = Array.from(timers.values()); return sessionId ? all.filter((t) => t.sessionId === sessionId) : all; }
  function clear() { for (const t of timers.values()) stop(t); timers.clear(); }
  function setEnqueue(fn) { if (typeof fn === 'function') enqueue = fn; }
  return { schedule, cancel, cancelSession, list, clear, setEnqueue, timers };
}

module.exports = { createTimerScheduler, DEFAULT_POLL_MS };
