// src/obsidian_skill.js
// Obsidian vault + open formats skill — work with local Markdown vaults,
// JSON Canvas, Bases, and frontmatter without any cloud dependency.
// Clean-room adaptation of ideas from obsidianmd/obsidian-skills (54,260⭐)
// and kepano's vault template (6,617⭐). No new tools required: the agent
// uses its existing file/shell tools; this module adds format helpers + skill.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

const SKILL_NAME = 'obsidian-vault';
const SKILL_DESCRIPTION = 'Work with local Obsidian-style Markdown vaults, JSON Canvas, Bases, and YAML frontmatter using plain files — no cloud, no proprietary API.';

// ---- Frontmatter (YAML subset) ----
function parseFrontmatter(text) {
  const s = String(text || '');
  const m = s.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: s };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else if (/^(true|false)$/i.test(v)) v = v.toLowerCase() === 'true';
    else v = v.replace(/^["']|["']$/g, '');
    meta[kv[1]] = v;
  }
  return { meta, body: s.slice(m[0].length) };
}

function serializeFrontmatter(meta, body) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(meta || {})) {
    if (Array.isArray(v)) lines.push(`${k}: [${v.join(', ')}]`);
    else lines.push(`${k}: ${v}`);
  }
  lines.push('---', '');
  return lines.join('\n') + String(body || '');
}

// ---- Wiki links ----
function links(text) {
  const out = [];
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let m;
  while ((m = re.exec(String(text || '')))) out.push({ target: m[1].trim(), alias: m[2] ? m[2].trim() : null });
  return out;
}

function backlinks(vaultDir, target) {
  const out = [];
  if (!fs.existsSync(vaultDir)) return out;
  for (const f of fs.readdirSync(vaultDir).filter((x) => x.endsWith('.md'))) {
    const text = fs.readFileSync(path.join(vaultDir, f), 'utf8');
    if (links(text).some((l) => l.target.toLowerCase() === String(target || '').toLowerCase())) out.push(f);
  }
  return out;
}

// ---- JSON Canvas (open infinite-canvas format) ----
function createCanvas(nodes, edges) {
  return JSON.stringify({
    version: 1,
    nodes: (nodes || []).map((n, i) => ({
      id: n.id || ('node' + i), type: n.type || 'text',
      x: n.x || i * 260, y: n.y || 0, width: n.width || 260, height: n.height || 160,
      text: n.text || '', file: n.file, label: n.label,
    })),
    edges: (edges || []).map((e, i) => ({
      id: e.id || ('edge' + i), fromNode: e.fromNode || e.from, toNode: e.toNode || e.to,
      fromSide: e.fromSide || 'right', toSide: e.toSide || 'left', label: e.label,
    })),
  }, null, 2);
}

function readCanvas(text) {
  try {
    const c = JSON.parse(String(text || ''));
    return { ok: true, version: c.version, nodes: (c.nodes || []).length, edges: (c.edges || []).length, nodeTypes: Array.from(new Set((c.nodes || []).map((n) => n.type))) };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

// ---- Bases (lightweight view definition) ----
function createBase(name, filter, properties) {
  return JSON.stringify({
    name: name || 'Base',
    filters: filter || { where: '' },
    properties: properties || ['file.name', 'file.mtime', 'tags'],
    views: [{ type: 'table', name: 'All', limit: 100 }],
  }, null, 2);
}

// ---- Vault helpers ----
function scanVault(dir, limit) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (d, depth) => {
    if (depth > 6 || out.length >= (limit || 500)) return;
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      if (out.length >= (limit || 500)) break;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!['.obsidian', '.git', 'node_modules'].includes(e.name)) walk(p, depth + 1); continue; }
      if (/\.(md|canvas|base)$/i.test(e.name)) {
        let stat; try { stat = fs.statSync(p); } catch (err) { continue; }
        out.push({ path: p, name: e.name, type: path.extname(e.name).slice(1), size: stat.size });
      }
    }
  };
  walk(dir, 0);
  return out;
}

function noteToKb(vaultNote) {
  const raw = fs.readFileSync(vaultNote, 'utf8');
  const { meta, body } = parseFrontmatter(raw);
  return { title: meta.title || path.basename(vaultNote, '.md'), tags: meta.tags || [], text: body.trim(), meta };
}

const BODY = `# ${SKILL_NAME}

${SKILL_DESCRIPTION}

## Formats
- **Markdown notes** — \`---\` YAML frontmatter (tags, title, aliases) + body with \`[[wiki links]]\`.
- **JSON Canvas** — open infinite-canvas format: \`nodes\` (text/file/image), \`edges\` (fromNode/toNode/sides).
- **Bases** — lightweight table/board views defined by filters + properties.
- Plain files only — the harness's local file/shell tools are enough; no plugin API needed.

## Method
1. **Locate the vault** — ask for a directory; scan with \`vault_scan\`.
2. **Read notes** — parse frontmatter, follow \`[[links]]\`, collect backlinks.
3. **Use existing retrieval** — feed note bodies into \`private_kb\` / \`hybrid_search\` for RAG.
4. **Write back** — use \`note_create\`/\`note_update\` with correct frontmatter and canvas JSON.
5. **Stay local** — never sync to a cloud service unless the user explicitly opts in.

## Rules
- Preserve existing frontmatter keys when updating notes.
- Wiki links are case-insensitive targets; report broken links as findings.
- JSON Canvas must be valid JSON with \`version: 1\`; verify with \`canvas_info\`.
- Export knowledge as plain Markdown + JSON so it remains portable to any harness.
`;

function skill() { return { name: SKILL_NAME, description: SKILL_DESCRIPTION, body: BODY }; }
function install() {
  const dir = path.join(DATA_DIR, 'skills', SKILL_NAME);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, 'SKILL.md');
  fs.writeFileSync(p, `---\nname: ${SKILL_NAME}\ndescription: ${SKILL_DESCRIPTION}\n---\n\n` + BODY);
  return { ok: true, name: SKILL_NAME, path: p };
}

function tools() {
  return [
    { name: 'obsidian_skill', description: 'Read or install the obsidian-vault skill.', inputSchema: { type: 'object', properties: { install: { type: 'boolean' } } } },
    { name: 'vault_scan', description: 'List notes/canvas/base files in a local Obsidian vault.', inputSchema: { type: 'object', properties: { dir: { type: 'string' }, limit: { type: 'number' } }, required: ['dir'] } },
    { name: 'vault_note_info', description: 'Parse frontmatter, body length, and wiki links from a vault note.', inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
    { name: 'vault_backlinks', description: 'Find notes linking to a target note.', inputSchema: { type: 'object', properties: { dir: { type: 'string' }, target: { type: 'string' } }, required: ['dir', 'target'] } },
    { name: 'canvas_info', description: 'Validate a JSON Canvas file.', inputSchema: { type: 'object', properties: { text: { type: 'string' } } } },
  ];
}

function dispatch(name, args) {
  args = args || {};
  if (name === 'obsidian_skill') return args.install ? install() : Object.assign({ ok: true }, skill());
  if (name === 'vault_scan') return { ok: true, count: scanVault(args.dir, args.limit).length, files: scanVault(args.dir, args.limit).slice(0, args.limit || 100) };
  if (name === 'vault_note_info') {
    if (!fs.existsSync(args.path)) return { ok: false, error: 'note not found' };
    const parsed = parseFrontmatter(fs.readFileSync(args.path, 'utf8'));
    return { ok: true, meta: parsed.meta, bodyLength: parsed.body.length, links: links(parsed.body) };
  }
  if (name === 'vault_backlinks') return { ok: true, target: args.target, notes: backlinks(args.dir, args.target) };
  if (name === 'canvas_info') return readCanvas(args.text);
  if (name === 'canvas_create') return { ok: true, json: createCanvas(args.nodes, args.edges) };
  if (name === 'base_create') return { ok: true, json: createBase(args.name, args.filter, args.properties) };
  if (name === 'note_to_kb') return fs.existsSync(args.path) ? { ok: true, note: noteToKb(args.path) } : { ok: false, error: 'note not found' };
  throw new Error('unknown obsidian tool: ' + name);
}

module.exports = {
  SKILL_NAME, SKILL_DESCRIPTION, BODY, parseFrontmatter, serializeFrontmatter,
  links, backlinks, createCanvas, readCanvas, createBase, scanVault, noteToKb,
  skill, install, tools, dispatch,
};
