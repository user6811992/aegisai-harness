// src/skill_sync.js
// Agent skill sync — clean-room Panniantong/skillshare idea. One source of truth
// for skills/rules/commands, sync to multiple harness skill directories.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { DATA_DIR } = require('./core/config');

const TARGETS = {
  claude: '.claude/skills',
  codex: '.codex/skills',
  opencode: '.config/opencode/skills',
  cursor: '.cursor/skills',
  copilot: '.github/copilot/skills',
  hermes: '.hermes/skills',
};

function sources() {
  const out = [];
  const local = path.join(DATA_DIR, 'skills');
  if (fs.existsSync(local)) for (const f of fs.readdirSync(local)) if (f.endsWith('.md')) out.push(path.join(local, f));
  const vendor = path.join(__dirname, '..', 'vendor', 'aegis', 'skills');
  if (fs.existsSync(vendor)) for (const d of fs.readdirSync(vendor)) {
    const sp = path.join(vendor, d, 'SKILL.md');
    if (fs.existsSync(sp)) out.push(sp);
  }
  return out;
}

function plan(targets, opts) {
  opts = opts || {};
  const chosen = (targets || Object.keys(TARGETS)).filter((t) => TARGETS[t]);
  const files = sources();
  return {
    ok: true,
    home: os.homedir(),
    targets: chosen.map((t) => ({ harness: t, dir: path.join(opts.home || os.homedir(), TARGETS[t]) })),
    skills: files.map((f) => ({ name: path.basename(f, '.md'), source: f })),
    dryRun: opts.dryRun !== false,
  };
}

function sync(targets, opts) {
  opts = opts || {};
  if (opts.dryRun !== false) return plan(targets, opts);
  const p = plan(targets, opts);
  let copied = 0;
  for (const t of p.targets) {
    fs.mkdirSync(t.dir, { recursive: true });
    for (const s of p.skills) {
      fs.copyFileSync(s.source, path.join(t.dir, path.basename(s.source)));
      copied += 1;
    }
  }
  return { ok: true, targets: p.targets.length, skills: p.skills.length, copied };
}

function tools() {
  return [
    { name: 'skill_sync_plan', description: 'Preview syncing local skills to harness directories.', inputSchema: { type: 'object', properties: { targets: { type: 'array' } } } },
    { name: 'skill_sync', description: 'Sync skills to harness directories (opt-in, writes files).', inputSchema: { type: 'object', properties: { targets: { type: 'array' }, dryRun: { type: 'boolean' } } } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'skill_sync_plan') return plan(args.targets, args);
  if (name === 'skill_sync') return sync(args.targets, args);
  throw new Error('unknown skill_sync tool: ' + name);
}
module.exports = { TARGETS, sources, plan, sync, tools, dispatch };
