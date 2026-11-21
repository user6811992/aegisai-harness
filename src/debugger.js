// src/debugger.js
// Debugger-like execution control: breakpoints, pause/step/resume, trace inspection.
class HarnessDebugger {
  constructor() { this.breakpoints = new Set(); this.paused = false; this.trace = []; this.stepQueue = []; }
  setBreakpoint(name) { this.breakpoints.add(name); return [...this.breakpoints]; }
  clearBreakpoint(name) { this.breakpoints.delete(name); }
  onEvent(e) {
    this.trace.push({ at: Date.now(), event: e.type || e, name: e.name, args: e.args });
    if (e.type === 'tool_call' && this.breakpoints.has(e.name)) this.paused = true;
  }
  shouldPause(toolName) {
    if (this.stepQueue.length) { this.stepQueue.shift(); return true; }
    return this.breakpoints.has(toolName);
  }
  step(n) { n = n || 1; for (let i = 0; i < n; i++) this.stepQueue.push(true); this.paused = false; }
  resume() { this.stepQueue = []; this.paused = false; }
  state() { return { breakpoints: [...this.breakpoints], paused: this.paused, queuedSteps: this.stepQueue.length, traceLength: this.trace.length }; }
  inspect(limit) { return this.trace.slice(-(limit || 50)); }
}

module.exports = { HarnessDebugger };
