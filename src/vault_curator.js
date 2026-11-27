// src/vault_curator.js
// Knowledge-graph maintenance for local Markdown vaults — clean-room adaptation
// of 0xNyk/obsidian-curator (MIT). Three jobs, all dry-run by default:
// rename (timestamp/category-shaped titles → claim-shaped, fix wikilinks),
// link (propose wikilinks between related notes), prune (orphaned old notes;
// hub-aware). Stdlib-only, local-only, no network.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');
const obsidian = require('./obsidian_skill');

function notes(vaultDir, limit) {
  if (!fs.existsSync(vaultDir)) return [];
  return obsidian.scanVault(vaultDir, limit).filter((f) => f.type === 'md').slice(0, limit || 500);
}

// Timestamp/category-shaped titles: "2024-01-15 Daily", "Meeting notes 12-03", "Category/Foo"
function shapeOfName(name) {
  const n = name.replace(/\.md$/i, '');
  const reasons = [];
  if (/\d{4}-\d{2}-\d{2}|\d{2}-\d{2}|\d{8}/.test(n)) reasons.push('timestamp');
  if (/^(meeting|notes|daily|weekly|journal|log|draft|todo)\b/i.test(n)) reasons.push('category');
  if (/[/\\]/.test(n)) reasons.push('path-shaped');
  return reasons;
}

function claimProposal(name, text) {
  const first = String(text || '').split(/\r?\n/).find((l) => /^#\s+\S/.test(l));
  let claim = first ? first.replace(/^#\s+/, '').trim() : '';
  if (!claim) {
    const sentence = String(text || '').replace(/^---[\s\S]*?---/, '').trim().split(/[.!?]\s/)[0] || '';
    claim = sentence.slice(0, 80).trim();
  }
  claim = claim.replace(/[\\/:*?"<>|]/g, '').trim();
  return claim || name.replace(/\.md$/i, '');
}

function renameProposals(vaultDir, opts) {
  const out = [];
  for (const f of notes(vaultDir, opts && opts.limit)) {
    const reasons = shapeOfName(f.name);
    if (!reasons.length) continue;
    const text = fs.readFileSync(f.path, 'utf8');
    const parsed = obsidian.parseFrontmatter(text);
    out.push({
      from: f.name,
      to: claimProposal(f.name, parsed.body) + '.md',
      reasons,
      path: f.path,
      note: 'claim-shaped title from content',
    });
  }
  return out;
}

// Link proposals: notes sharing >=2 significant terms not yet linked.
const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'was', 'were', 'into', 'about', 'have', 'has']);
function terms(text) {
  const parsed = obsidian.parseFrontmatter(text);
  return new Set(obsidian.tokenize ? obsidian.tokenize(parsed.body) : (parsed.body.toLowerCase().match(/[a-z0-9_]+/g) || []).filter((t) => !STOP.has(t) && t.length > 3));
}
function linkProposals(vaultDir, opts) {
  const ns = notes(vaultDir, opts && opts.limit);
  const data = ns.map((f) => {
    const text = fs.readFileSync(f.path, 'utf8');
    return { file: f.name, path: f.path, set: terms(text), links: new Set(obsidian.links(text).map((l) => l.target.toLowerCase())) };
  });
  const out = [];
  for (let i = 0; i < data.length; i += 1) {
    for (let j = i + 1; j < data.length; j += 1) {
      const a = data[i], b = data[j];
      if (a.links.has(b.file.toLowerCase()) || b.links.has(a.file.toLowerCase())) continue;
      const shared = [...a.set].filter((t) => b.set.has(t));
      if (shared.length >= (opts && opts.minShared) || 2) {
        out.push({ from: a.file, to: b.file, shared: shared.slice(0, 8) });
      }
    }
  }
  return out;
}

function pruneCandidates(vaultDir, opts) {
  const days = (opts && opts.maxAgeDays) || 30;
  const cutoff = Date.now() - days * 86400000;
  const ns = notes(vaultDir, opts && opts.limit);
  const inbound = new Map();
  for (const f of ns) {
    const text = fs.readFileSync(f.path, 'utf8');
    for (const l of obsidian.links(text)) inbound.set(l.target.toLowerCase(), (inbound.get(l.target.toLowerCase()) || 0) + 1);
  }
  const out = [];
  for (const f of ns) {
    let mtime = 0;
    try { mtime = fs.statSync(f.path).mtimeMs; } catch (e) { continue; }
    const base = f.name.replace(/\.md$/i, '').toLowerCase();
    if (mtime > cutoff) continue;
    if (inbound.get(base)) continue;
    if (/^(map of content|moc|index|home|00-home)/i.test(base)) continue; // hub-aware
    out.push({ file: f.name, ageDays: Math.floor((Date.now() - mtime) / 86400000), inlinks: 0 });
  }
  return out;
}

function report(vaultDir, opts) {
  opts = opts || {};
  return {
    ok: true,
    vault: vaultDir,
    dryRun: opts.dryRun !== false,
    generated: new Date().toISOString(),
    renames: renameProposals(vaultDir, opts),
    links: linkProposals(vaultDir, opts),
    prune: pruneCandidates(vaultDir, opts),
    note: 'dry-run by default; no files are mutated unless explicitly applied',
  };
}

function tools() {
  return [
    { name: 'vault_curator_report', description: 'Dry-run knowledge-graph maintenance report (rename/link/prune proposals) for a local vault.', inputSchema: { type: 'object', properties: { dir: { type: 'string' }, maxAgeDays: { type: 'number' } }, required: ['dir'] } },
  ];
}

function dispatch(name, args) {
  args = args || {};
  if (name === 'vault_curator_report') return report(args.dir, args);
  throw new Error('unknown vault_curator tool: ' + name);
}

module.exports = { notes, shapeOfName, claimProposal, renameProposals, linkProposals, pruneCandidates, report, tools, dispatch };
