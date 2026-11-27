// src/local_control.js
// LACP-style local control plane — clean-room adaptation of 0xNyk/lacp (MIT).
// Deterministic routing, risk-tier approval gates, execution records (evidence),
// memory controls and rollback paths for coding agents. Local-first; remote
// execution is opt-in. Complements (does not replace) the older control_plane.js.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const rollback = require('./rollback');
const ledger = require('./ledger');

const DIR = () => path.join(DATA_DIR, 'local-control');
const RECORDS = () => path.join(DIR(), 'records');

const TIERS = {
  read: { level: 0, tools: ['read_file', 'search_code', 'get_time', 'get_repo_map', 'recall_archived_context'] },
  write: { level: 1, tools: ['write_file', 'edit_file', 'copy_file', 'move_file'] },
  destructive: { level: 2, tools: ['delete_file', 'run_command', 'run_python', 'browser_eval'] },
  external: { level: 3, tools: ['fetch_url', 'http_request', 'web_search', 'hf_model_download', 'lightpanda_fetch'] },
};

function classify(toolName) {
  for (const [tier, def] of Object.entries(TIERS)) if (def.tools.includes(toolName)) return { tier, level: def.level };
  return { tier: 'write', level: 1 };
}

function policy(opts) {
  opts = opts || {};
  return {
    maxTier: opts.maxTier || 'external',
    requireApprovalAbove: opts.requireApprovalAbove != null ? opts.requireApprovalAbove : 1,
    allowRemote: !!opts.allowRemote,
    evidenceRequired: opts.evidenceRequired !== false,
    rollbackSnapshots: opts.rollbackSnapshots !== false,
  };
}

function gate(toolName, args, ctx, pol) {
  ctx = ctx || {};
  pol = pol || policy();
  const cls = classify(toolName);
  const maxLevel = (TIERS[pol.maxTier] || TIERS.external).level;
  const issues = [];
  if (cls.level > maxLevel) issues.push(`tier ${cls.tier} exceeds max ${pol.maxTier}`);
  if (cls.level > pol.requireApprovalAbove && !ctx.approved) issues.push(`approval required for ${cls.tier} action`);
  if (cls.tier === 'external' && !pol.allowRemote && ctx.offline) issues.push('remote action disabled in offline mode');
  if (pol.evidenceRequired && (cls.tier === 'write' || cls.tier === 'destructive')) {
    const p = args && (args.path || args.file_path || args.url);
    const prior = (ctx.toolLog || []).some((t) => t.name === 'read_file' && t.args && (t.args.path === p || t.args.file_path === p));
    if (!prior && !ctx.approved) issues.push('no evidence of prior read for ' + (p || 'target'));
  }
  return { allowed: issues.length === 0, tier: cls.tier, level: cls.level, issues, policy: pol };
}

function recordRun(runId, data) {
  fs.mkdirSync(RECORDS(), { recursive: true });
  const rec = Object.assign({ runId: runId || ('run_' + Date.now().toString(36)), ts: new Date().toISOString() }, data || {});
  fs.writeFileSync(path.join(RECORDS(), rec.runId + '.json'), JSON.stringify(rec, null, 2));
  try { ledger.append('local_control_record', { runId: rec.runId, tools: (rec.toolLog || []).length, verdict: rec.verdict || 'pending' }); } catch (e) {}
  return rec;
}
function getRun(runId) { try { return JSON.parse(fs.readFileSync(path.join(RECORDS(), runId + '.json'), 'utf8')); } catch (e) { return null; } }
function listRuns() {
  if (!fs.existsSync(RECORDS())) return [];
  return fs.readdirSync(RECORDS()).filter((f) => f.endsWith('.json')).map((f) => {
    const r = getRun(f.slice(0, -5));
    return r ? { runId: r.runId, ts: r.ts, verdict: r.verdict, tools: (r.toolLog || []).length } : null;
  }).filter(Boolean);
}
function snapshot(toolName, args, projectRoot) {
  if (!policy().rollbackSnapshots) return null;
  const p = args && (args.path || args.file_path);
  return p ? rollback.snapshotFile(p, projectRoot) : null;
}
function toolLogSummary(log) { return (log || []).map((t) => ({ name: t.name, tier: classify(t.name).tier, ok: t.ok !== false })); }

function tools() {
  return [
    { name: 'local_control_policy', description: 'Build a deterministic local run policy (risk tiers, approvals, rollback).', inputSchema: { type: 'object', properties: { maxTier: { type: 'string' }, allowRemote: { type: 'boolean' } } } },
    { name: 'local_control_gate', description: 'Gate a tool call against the local control policy.', inputSchema: { type: 'object', properties: { toolName: { type: 'string' }, approved: { type: 'boolean' }, offline: { type: 'boolean' } }, required: ['toolName'] } },
    { name: 'local_control_record', description: 'Record an execution with evidence and verdict.', inputSchema: { type: 'object', properties: { runId: { type: 'string' }, verdict: { type: 'string' } } } },
    { name: 'local_control_list', description: 'List recorded local-control runs.', inputSchema: { type: 'object' } },
  ];
}

function dispatch(name, args) {
  args = args || {};
  if (name === 'local_control_policy') return Object.assign({ ok: true }, policy(args));
  if (name === 'local_control_gate') return Object.assign({ ok: true }, gate(args.toolName, args.args, args, args.policy ? policy(args.policy) : policy()));
  if (name === 'local_control_record') return Object.assign({ ok: true }, recordRun(args.runId, { verdict: args.verdict, toolLog: args.toolLog }));
  if (name === 'local_control_list') return { ok: true, runs: listRuns() };
  if (name === 'local_control_snapshot') return { ok: true, id: snapshot(args.toolName, args.args, args.projectRoot) };
  throw new Error('unknown local_control tool: ' + name);
}

module.exports = { TIERS, classify, policy, gate, recordRun, getRun, listRuns, snapshot, toolLogSummary, tools, dispatch };
