// src/event_bus.js
// Event-driven plugin architecture: typed events, wildcard, priority, async dispatch.
class EventBus {
  constructor() { this.handlers = new Map(); }
  on(event, fn, opts) {
    opts = opts || {};
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event).push({ fn, priority: opts.priority || 0, once: !!opts.once, plugin: opts.plugin || '' });
    this.handlers.get(event).sort((a, b) => b.priority - a.priority);
    return () => this.off(event, fn);
  }
  off(event, fn) {
    const arr = this.handlers.get(event) || [];
    const i = arr.findIndex((h) => h.fn === fn);
    if (i >= 0) arr.splice(i, 1);
  }
  async emit(event, payload) {
    const results = [];
    const matching = [...(this.handlers.get(event) || []), ...(this.handlers.get('*') || [])];
    matching.sort((a, b) => b.priority - a.priority);
    for (const h of matching) {
      try {
        const r = await h.fn({ event, payload, plugin: h.plugin });
        results.push({ plugin: h.plugin, result: r });
      } catch (e) { results.push({ plugin: h.plugin, error: String(e.message || e) }); }
      if (h.once) this.off(event, h.fn);
    }
    return results;
  }
  events() { return [...this.handlers.keys()]; }
}

const bus = new EventBus();

module.exports = { EventBus, bus };
