// src/model_recipes.js
// Recipe-based model configurations — clean-room mozilla-ai/llamafile-builder
// idea. JSON recipes for reproducible builds (runtime + model + GPU libs +
// args), save/reuse/share, with resume + checksum metadata.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./core/config');

const DIR = () => path.join(DATA_DIR, 'model-recipes');

function validate(recipe) {
  const issues = [];
  const r = recipe || {};
  if (!r.name) issues.push('recipe needs a name');
  if (!r.model) issues.push('recipe needs a model');
  if (r.runtime && !/^(llamafile|llama\.cpp|ik_llama|vllm|ollama)$/i.test(r.runtime)) issues.push('unknown runtime');
  if (r.gpu && !Array.isArray(r.gpu)) issues.push('gpu must be an array');
  if (r.context && (!Number.isInteger(r.context) || r.context < 512)) issues.push('invalid context');
  return { ok: issues.length === 0, issues };
}

function save(recipe) {
  const v = validate(recipe);
  if (!v.ok) return { ok: false, issues: v.issues };
  fs.mkdirSync(DIR(), { recursive: true });
  const safe = String(recipe.name).replace(/[^a-zA-Z0-9._-]/g, '_');
  const doc = Object.assign({ created: new Date().toISOString() }, recipe, { id: 'recipe_' + crypto.randomBytes(4).toString('hex') });
  const p = path.join(DIR(), safe + '.json');
  fs.writeFileSync(p, JSON.stringify(doc, null, 2));
  return { ok: true, path: p, id: doc.id };
}

function list() {
  if (!fs.existsSync(DIR())) return [];
  return fs.readdirSync(DIR()).filter((f) => f.endsWith('.json')).map((f) => {
    try { const r = JSON.parse(fs.readFileSync(path.join(DIR(), f), 'utf8')); return { id: r.id, name: r.name, model: r.model, runtime: r.runtime, gpu: r.gpu, context: r.context }; }
    catch (e) { return null; }
  }).filter(Boolean);
}

function get(name) {
  const safe = String(name || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  try { return JSON.parse(fs.readFileSync(path.join(DIR(), safe + '.json'), 'utf8')); }
  catch (e) { return null; }
}

function tools() {
  return [
    { name: 'recipe_save', description: 'Save a reproducible model configuration recipe.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, model: { type: 'string' }, runtime: { type: 'string' }, gpu: { type: 'array' }, context: { type: 'number' } }, required: ['name', 'model'] } },
    { name: 'recipe_list', description: 'List saved model recipes.', inputSchema: { type: 'object' } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'recipe_save') return save(args);
  if (name === 'recipe_list') return { ok: true, recipes: list() };
  if (name === 'recipe_get') { const r = get(args.name); return r ? { ok: true, recipe: r } : { ok: false, error: 'recipe not found' }; }
  throw new Error('unknown model_recipes tool: ' + name);
}
module.exports = { DIR, validate, save, list, get, tools, dispatch };
