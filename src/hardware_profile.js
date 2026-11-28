// src/hardware_profile.js
// Portable, shareable hardware optimization profiles. Only whitelisted fields
// are accepted — a profile can never carry a command, URL script, or shell
// injection. Profiles are local files under data/profiles/ and are applied at
// startup when data/profiles/active.json exists.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const { isSupportedBackend } = require('./backends');

const DIR = () => path.join(DATA_DIR, 'profiles');
const ACTIVE = () => path.join(DIR(), 'active.json');
const safeName = (n) => String(n || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64);

// field -> validator (returns true when the value is safe)
const FIELDS = {
  name: (v) => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,63}$/.test(v),
  backendType: (v) => typeof v === 'string' && isSupportedBackend(v),
  engine: (v) => typeof v === 'string' && /^[a-zA-Z0-9._() -]{1,40}$/.test(v),
  quant: (v) => typeof v === 'string' && /^[a-zA-Z0-9._-]{1,24}$/.test(v),
  context: (v) => Number.isInteger(v) && v >= 512 && v <= 262144,
  threads: (v) => Number.isInteger(v) && v >= 1 && v <= 128,
  gpuLayers: (v) => Number.isInteger(v) && v >= 0 && v <= 999,
  host: (v) => typeof v === 'string' && /^[a-zA-Z0-9._-]{1,60}$/.test(v),
  port: (v) => Number.isInteger(v) && v >= 1 && v <= 65535,
  model: (v) => typeof v === 'string' && v.length <= 260 && !/[\x00-\x1f]/.test(v),
  flags: (v) => Array.isArray(v) && v.length <= 16 && v.every((f) => typeof f === 'string' && /^-{1,2}[a-zA-Z0-9._=@:/,+*-]{1,60}$/.test(f)),
  notes: (v) => typeof v === 'string' && v.length <= 500,
};

function validate(input) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  const warnings = [];
  for (const [k, v] of Object.entries(src)) {
    if (!FIELDS[k]) { warnings.push('dropped unsupported field: ' + k); continue; }
    if (v === undefined || v === '') continue;
    if (!FIELDS[k](v)) { warnings.push('dropped invalid field: ' + k); continue; }
    out[k] = v;
  }
  if (!out.name) return { ok: false, error: 'profile name is required', warnings };
  return { ok: true, profile: out, warnings };
}

function file(name) { return path.join(DIR(), safeName(name) + '.json'); }
function save(name, input) {
  const v = validate(Object.assign({}, input || {}, { name: name || (input && input.name) }));
  if (!v.ok) return v;
  fs.mkdirSync(DIR(), { recursive: true });
  const doc = { ...v.profile, id: safeName(v.profile.name), saved: new Date().toISOString() };
  fs.writeFileSync(file(v.profile.name), JSON.stringify(doc, null, 2));
  return { ok: true, profile: doc, warnings: v.warnings };
}
function get(name) {
  try { return JSON.parse(fs.readFileSync(file(name), 'utf8')); } catch (e) { return null; }
}
function list() {
  if (!fs.existsSync(DIR())) return [];
  let activeName = null;
  try { activeName = JSON.parse(fs.readFileSync(ACTIVE(), 'utf8')).name; } catch (e) {}
  return fs.readdirSync(DIR()).filter((f) => f.endsWith('.json') && f !== 'active.json').map((f) => {
    try {
      const p = JSON.parse(fs.readFileSync(path.join(DIR(), f), 'utf8'));
      return { id: p.id, name: p.name, backendType: p.backendType, engine: p.engine, quant: p.quant, context: p.context, saved: p.saved, active: p.name === activeName };
    } catch (e) { return null; }
  }).filter(Boolean);
}
function remove(name) {
  const p = file(name);
  if (!fs.existsSync(p)) return { ok: false, error: 'profile not found' };
  fs.rmSync(p, { force: true });
  try { const a = JSON.parse(fs.readFileSync(ACTIVE(), 'utf8')); if (a.name === name) fs.rmSync(ACTIVE(), { force: true }); } catch (e) {}
  return { ok: true, removed: safeName(name) };
}
function exportProfile(name) {
  const p = get(name);
  return p ? { ok: true, json: JSON.stringify(p, null, 2) } : { ok: false, error: 'profile not found' };
}
function importProfile(json) {
  let parsed;
  try { parsed = JSON.parse(json); } catch (e) { return { ok: false, error: 'invalid JSON' }; }
  const { id, saved, ...rest } = parsed;
  return save(rest.name, rest);
}
function setActive(name) {
  if (!get(name)) return { ok: false, error: 'profile not found' };
  fs.mkdirSync(DIR(), { recursive: true });
  fs.writeFileSync(ACTIVE(), JSON.stringify({ name, setAt: new Date().toISOString() }));
  return { ok: true, name };
}
function active() {
  let ref;
  try { ref = JSON.parse(fs.readFileSync(ACTIVE(), 'utf8')); } catch (e) { return null; }
  const p = ref && get(ref.name);
  if (!p) return null;
  const v = validate(p);
  return v.ok ? v.profile : null;
}
function apply(profile) {
  const v = validate(profile);
  if (!v.ok) return v;
  const p = v.profile;
  const env = {};
  if (p.backendType) { process.env.BACKEND_TYPE = p.backendType; env.BACKEND_TYPE = p.backendType; }
  if (p.host && p.port) {
    process.env.BACKEND_URL = `http://${p.host}:${p.port}`;
    env.BACKEND_URL = process.env.BACKEND_URL;
  }
  if (p.model) { process.env.AEGISAI_MODEL = p.model; env.AEGISAI_MODEL = p.model; }
  if (p.threads) { process.env.AEGISAI_THREADS = String(p.threads); env.AEGISAI_THREADS = String(p.threads); }
  if (p.context) { process.env.AEGISAI_CONTEXT = String(p.context); env.AEGISAI_CONTEXT = String(p.context); }
  if (p.flags && p.flags.length) { process.env.AEGISAI_BACKEND_FLAGS = p.flags.join(' '); env.AEGISAI_BACKEND_FLAGS = process.env.AEGISAI_BACKEND_FLAGS; }
  try { require('./backends').setBackend(p.backendType, env.BACKEND_URL); } catch (e) {}
  try {
    const settings = require('./settings');
    const s = settings.load() || {};
    for (const [k, val] of Object.entries(env)) if (['BACKEND_TYPE','BACKEND_URL','AEGISAI_MODEL'].includes(k)) s[k] = val;
    settings.save(s);
  } catch (e) {}
  return { ok: true, profile: p, env, warnings: v.warnings };
}
function applyActive() {
  const p = active();
  return p ? apply(p) : { ok: false, skipped: true, reason: 'no active hardware profile' };
}
function suggest() {
  try {
    const t = require('./hardware_autotune').tune(null, { dryRun: true });
    const s = t.settings || {};
    return { ok: true, profile: {
      name: 'auto-' + String(t.profile || 'detected').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40),
      backendType: s.backendType, engine: s.engine, quant: s.quantization, context: Number(s.context) || 8192,
      notes: String(t.note || '').slice(0, 500) || 'Generated from detected hardware — review before sharing.',
    } };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function tools() {
  return [
    { name: 'hardware_profile_list', description: 'List saved hardware profiles.', inputSchema: { type: 'object' } },
    { name: 'hardware_profile_save', description: 'Save a validated hardware profile.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, profile: { type: 'object' } }, required: ['name'] } },
    { name: 'hardware_profile_apply', description: 'Apply a saved profile at runtime.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
    { name: 'hardware_profile_suggest', description: 'Suggest a profile from detected hardware.', inputSchema: { type: 'object' } },
  ];
}
async function dispatch(name, args) {
  args = args || {};
  if (name === 'hardware_profile_list') return { ok: true, profiles: list(), active: active() };
  if (name === 'hardware_profile_save') return save(args.name, args.profile);
  if (name === 'hardware_profile_apply') {
    const p = get(args.name);
    if (!p) return { ok: false, error: 'profile not found' };
    const marked = setActive(args.name);
    return { ...apply(p), active: marked.ok };
  }
  if (name === 'hardware_profile_active') { const p = active(); return p ? { ok: true, profile: p } : { ok: false, error: 'no active profile' }; }
  if (name === 'hardware_profile_suggest') return suggest();
  if (name === 'hardware_profile_import') return importProfile(args.json);
  throw new Error('unknown hardware_profile tool: ' + name);
}
module.exports = { DIR, ACTIVE, FIELDS, safeName, validate, save, get, list, remove, exportProfile, importProfile, setActive, active, apply, applyActive, suggest, tools, dispatch };
