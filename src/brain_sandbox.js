// src/brain_sandbox.js
// Formal brain + sandbox interfaces ("IaC for agents") with pluggable implementations.
const { runAgent } = require('./agent/run');

class LocalBrain {
  constructor(opts) { this.name = opts && opts.name || 'local-brain'; this.model = (opts && opts.model) || process.env.AEGISAI_MODEL || 'llama3.2:3b'; }
  async *run(prompt, opts) {
    const r = await runAgent({ model: this.model, messages: [{ role: 'user', content: prompt }], projectRoot: (opts && opts.cwd) || process.cwd(), autoApprove: true, onEvent: (e) => { if (e.type === 'token') this._last = (this._last || '') + (e.content || ''); } });
    yield { type: 'message', content: (r.final && r.final.final) || '' };
    yield { type: 'done', usage: (r.final && r.final.tokenStats) || null };
  }
  abort() { this._aborted = true; }
}

class Sandbox {
  constructor(name) { this.name = name || 'sandbox'; }
  async create() { return { ok: true }; }
  async destroy() { return { ok: true }; }
  async exec(command, options) {
    const { spawnSync } = require('child_process');
    const r = spawnSync(command, (options && options.args) || [], { cwd: (options && options.cwd) || process.cwd(), encoding: 'utf8', timeout: (options && options.timeout) || 30000 });
    return { exitCode: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
  }
}
class LocalSandbox extends Sandbox { constructor() { super('local'); } }
class SealedSandbox extends Sandbox {
  constructor() { super('sealed'); }
  async exec(command, options) { return require('./sealed').run(command, options); }
}

class Agent {
  constructor(opts) { this.brain = (opts && opts.brain) || new LocalBrain(); this.sandbox = (opts && opts.sandbox) || new LocalSandbox(); this.events = []; }
  async *run(prompt, opts) { for await (const e of this.brain.run(prompt, opts)) { this.events.push(e); yield e; } }
}

module.exports = { LocalBrain, Sandbox, LocalSandbox, SealedSandbox, Agent };
