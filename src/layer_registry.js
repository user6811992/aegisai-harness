// src/layer_registry.js
// Swappable layer registry: map layer names to implementations, swap at runtime.
const registry = {
  brain: { default: 'local', implementations: { local: null } },
  sandbox: { default: 'sealed', implementations: { 
    local: { ok: false, error: 'local sandbox not configured. set AEGISAI_SANDBOX_ALLOW_LOCAL=true to enable' }, 
    sealed: require('./sealed'), 
    podman: require('./podman') 
  } },
  memory: { default: 'sqlite', implementations: { sqlite: null, graph: null, temporal: null } },
  backend: { default: 'ollama', implementations: { ollama: null, openai: null, router: null } },
  policy: { default: 'default', implementations: { default: null, charter: null, ahp: null } },
};

function layers() { return Object.keys(registry); }
function get(layer) { return registry[layer] ? { default: registry[layer].default, available: Object.keys(registry[layer].implementations) } : null; }
function use(layer, impl) {
  if (!registry[layer] || !Object.prototype.hasOwnProperty.call(registry[layer].implementations, impl)) return { ok: false, error: 'unknown layer/implementation' };
  const prev = registry[layer].default;
  registry[layer].default = impl;
  return { ok: true, layer, previous: prev, current: impl };
}
function register(layer, impl, factory) {
  if (!registry[layer]) registry[layer] = { default: impl, implementations: {} };
  registry[layer].implementations[impl] = factory || true;
  return { ok: true, layer, impl };
}

module.exports = { layers, get, use, register };