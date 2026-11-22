// src/variants.js
// Variants extension: A/B selection for tools/prompts (modelcontextprotocol/experimental-ext-variants).
const variants = new Map();

function register(name, options) {
  variants.set(name, Object.assign({ name, variants: [], default: 0 }, options || {}));
  return name;
}
function addVariant(name, impl, weight) {
  const v = variants.get(name);
  if (!v) return null;
  v.variants.push({ impl, weight: weight || 1 });
  return v.variants.length;
}
function pick(name) {
  const v = variants.get(name);
  if (!v || !v.variants.length) return null;
  const total = v.variants.reduce((a, x) => a + (x.weight || 1), 0);
  let r = Math.random() * total;
  for (const x of v.variants) { r -= x.weight || 1; if (r <= 0) return x.impl; }
  return v.variants[v.variants.length - 1].impl;
}
function list() { return [...variants.values()].map((v) => ({ name: v.name, variants: v.variants.length, default: v.default })); }

module.exports = { register, addVariant, pick, list };
