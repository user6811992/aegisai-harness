// src/model_registry.js
// Unified model registry: aggregate discovery across all local backends,
// deduplicate split shards and bridged copies, and surface a single catalog.
const modelDiscovery = require('./model_discovery');
const bridge = require('./model_bridge');

const PROVIDERS = ['ollama', 'lmstudio', 'llamacpp', 'vllm', 'openai', 'generic'];

function normalizeName(name) {
  return String(name || '').toLowerCase()
    .replace(/\.gguf$/, '')
    .replace(/-?\d{5}-of-\d{5}$/, '')
    .replace(/[-_.:]/g, '')
    .replace(/^sha256-/, '')
    .slice(0, 80);
}

function collect(rootsByProvider, maxFiles) {
  const out = [];
  for (const provider of PROVIDERS) {
    const roots = rootsByProvider && rootsByProvider[provider];
    let found = [];
    try { found = modelDiscovery.scan(roots, maxFiles || 500, provider); }
    catch (e) { found = []; }
    for (const f of found) out.push(Object.assign({ provider }, f));
  }
  return out;
}

function dedupe(items) {
  const seen = new Map();
  const out = [];
  for (const item of items) {
    const key = normalizeName(item.name) + '|' + Math.round((item.sizeGB || 0) * 10);
    if (seen.has(key)) {
      const prior = seen.get(key);
      if (prior.providers && !prior.providers.includes(item.provider)) prior.providers.push(item.provider);
      prior.bridged = true;
      continue;
    }
    const copy = Object.assign({}, item, { providers: [item.provider], bridged: false });
    seen.set(key, copy);
    out.push(copy);
  }
  return out;
}

function catalog(opts) {
  opts = opts || {};
  const items = dedupe(collect(opts.roots, opts.maxFiles));
  const stores = bridge.detectModelStores(opts.root);
  const byProvider = {};
  for (const item of items) byProvider[item.provider] = (byProvider[item.provider] || 0) + 1;
  return {
    generated: new Date().toISOString(),
    total: items.length,
    unique: items.length,
    duplicated: items.filter((i) => i.bridged).length,
    byProvider,
    bridgeAvailable: stores.canBridge,
    models: items.map((m) => ({
      name: m.name, provider: m.provider, providers: m.providers,
      sizeGB: m.sizeGB, type: m.type, path: m.path,
      split: m.split, bridged: m.bridged,
    })),
  };
}

function tools() {
  return [
    { name: 'model_registry_catalog', description: 'Unified deduplicated catalog of models across all local providers.', inputSchema: { type: 'object' } },
  ];
}

function dispatch(name, args) {
  if (name === 'model_registry_catalog') return catalog(args || {});
  throw new Error('unknown model_registry tool: ' + name);
}

module.exports = { catalog, collect, dedupe, normalizeName, PROVIDERS, tools, dispatch };
