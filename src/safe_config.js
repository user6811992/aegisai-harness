// src/safe_config.js
// Config API hardening — clean-room pattern from Martossien/dashboard-llm.
// Field whitelist, input validation, atomic writes, file locking.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOCKS = new Map();

function validate(schema, input) {
  const out = {};
  const issues = [];
  const data = input || {};
  for (const [field, rule] of Object.entries(schema)) {
    const value = data[field];
    if (value === undefined) {
      if (rule.required) issues.push(`missing required field: ${field}`);
      continue;
    }
    if (rule.type === 'string' && typeof value !== 'string') { issues.push(`${field} must be string`); continue; }
    if (rule.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) { issues.push(`${field} must be number`); continue; }
    if (rule.type === 'boolean' && typeof value !== 'boolean') { issues.push(`${field} must be boolean`); continue; }
    if (rule.enum && !rule.enum.includes(value)) { issues.push(`${field} must be one of ${rule.enum.join(', ')}`); continue; }
    if (rule.min != null && value < rule.min) { issues.push(`${field} below minimum`); continue; }
    if (rule.max != null && value > rule.max) { issues.push(`${field} above maximum`); continue; }
    if (rule.maxLength && String(value).length > rule.maxLength) { issues.push(`${field} too long`); continue; }
    if (rule.pattern && !rule.pattern.test(String(value))) { issues.push(`${field} invalid format`); continue; }
    out[field] = value;
  }
  for (const k of Object.keys(data)) if (!(k in schema)) issues.push(`unknown field rejected: ${k}`);
  return { ok: issues.length === 0, value: out, issues };
}

function withLock(filePath, fn) {
  const key = path.resolve(filePath);
  if (LOCKS.has(key)) throw new Error('config write already in progress: ' + key);
  LOCKS.set(key, true);
  try { return fn(); }
  finally { LOCKS.delete(key); }
}

function atomicWrite(filePath, data, opts) {
  opts = opts || {};
  return withLock(filePath, () => {
    const target = path.resolve(filePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (opts.backup && fs.existsSync(target)) {
      fs.copyFileSync(target, target + '.bak');
    }
    const tmp = target + '.' + crypto.randomBytes(4).toString('hex') + '.tmp';
    fs.writeFileSync(tmp, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    fs.renameSync(tmp, target);
    return { ok: true, path: target, bytes: fs.statSync(target).size };
  });
}

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (e) { return null; }
}

function tools() {
  return [
    { name: 'config_validate', description: 'Validate input against a field-whitelist schema.', inputSchema: { type: 'object', properties: { schema: { type: 'object' }, input: { type: 'object' } } } },
    { name: 'config_atomic_write', description: 'Write config atomically with file locking and optional backup.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, data: { type: 'object' }, backup: { type: 'boolean' } }, required: ['path'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'config_validate') return validate(args.schema, args.input);
  if (name === 'config_atomic_write') return atomicWrite(args.path, args.data, args);
  if (name === 'config_read') return { ok: true, data: readJson(args.path) };
  throw new Error('unknown safe_config tool: ' + name);
}
module.exports = { validate, withLock, atomicWrite, readJson, tools, dispatch };
