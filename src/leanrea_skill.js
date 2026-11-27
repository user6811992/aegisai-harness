// src/leanrea_skill.js
// Lean REA — a zero-tool reverse-engineering methodology skill.
// Clean-room adaptation of aicodeking/leanrea (8 KB SKILL.md idea): instead of
// an MCP layer with 200+ tools, teach the agent which real CLI tools to run.
// No new tools are added to the registry; the agent uses its existing shell.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { DATA_DIR } = require('./core/config');

const SKILL_NAME = 'lean-rea';
const SKILL_DESCRIPTION = 'Reverse engineer anything using plain CLI tools (no MCP layer): fastest command per target type, ready-to-paste recon, and known traps.';

// Target type -> recommended CLI commands (fast path first)
const RECON = {
  electron: [
    'asar list app.asar | head -50',
    'asar extract app.asar /tmp/app_extracted && rg -uu "ipcMain|ipcRenderer" /tmp/app_extracted',
    'node -e "console.log(require(\'./package.json\').version)"',
  ],
  macho: [
    'otool -L binary',
    'otool -tv binary | head -80',
    'nm -gU binary | head -50',
    'codesign -dv --verbose=4 binary 2>&1',
  ],
  go: [
    'go version -m binary',
    'strings binary | grep -E "go1\\.|build\\s+-" | head -20',
  ],
  pe: [
    'file binary',
    'objdump -p binary | grep -E "DLL Name|Export Address Table"',
    'strings binary | grep -E "\\\\\\\\.\\\\|CreateFile|RegOpen" | head -30',
  ],
  apk: [
    'aapt dump badging app.apk | head -20',
    'apktool d app.apk -o /tmp/apk_out',
    'jadx -d /tmp/jadx_out app.apk',
  ],
  elf: [
    'file binary && readelf -h binary',
    'readelf -sW binary | head -50',
    'objdump -d binary | head -100',
    'strings binary | grep -E "http|/proc|socket" | head -30',
  ],
  archive: [
    'binwalk binary',
    'tar tf archive.tar 2>/dev/null | head -50',
    'unzip -l archive.zip 2>/dev/null | head -50',
  ],
  network: [
    'tshark -r capture.pcap -q -z conv,tcp',
    'tcpdump -nn -r capture.pcap | head -50',
  ],
};

// Known traps the REA MCP code handles for you — surfaced as agent guidance.
const TRAPS = [
  'Electron asar may be integrity-protected: pass the right flag or extract fails. Extract then rg, do not trust one tool.',
  'A single RE tool returning 140 MB of JSON floods context: pipe through head/rg and write large output to a file.',
  'Go stripped binaries still expose build info via `go version -m` — use it before disassembly.',
  'Mach-O code signing / TCC entitlements matter: check codesign and otool -l, not just symbols.',
  'Do not paste proprietary source code into the conversation; summarize behavior and protocol instead.',
  'Prefer raw CLI over MCP wrappers when latency matters (REA: 3.3s vs otool: 0.04s).',
];

const BODY = `# ${SKILL_NAME} — Lean Reverse Engineering

${SKILL_DESCRIPTION}

## Method
1. **Identify the target type** from \`file\` / extension / magic bytes.
2. **Run the fast recon command** for that type (below). Do not load a heavy MCP server.
3. **Read the real output** — pipe through \`head\`/\`rg\`, save large output to a file.
4. **Go deeper only where needed** — disassembly, entitlements, IPC, protocol.
5. **Report behavior and evidence**, not guesses. Cite file:line or command output.

## Fast recon by target type
${Object.entries(RECON).map(([k, cmds]) => `### ${k}\n${cmds.map((c) => '```bash\n' + c + '\n```').join('\n')}`).join('\n\n')}

## Known traps
${TRAPS.map((t) => '- ' + t).join('\n')}

## Rules
- Use the agent's existing shell tool. **No new tools are registered.**
- If a command is missing, say so and use the closest available alternative.
- Keep total tool calls small; batch recon into one shell invocation where safe.
- Finish with a short evidence-backed summary: what the target is, how it behaves, and what is still unknown.
`;

function skill() {
  return { name: SKILL_NAME, description: SKILL_DESCRIPTION, body: BODY };
}

// Install the skill as a SKILL.md in the data skills directory (and return path).
function install() {
  const dir = path.join(DATA_DIR, 'skills', SKILL_NAME);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, 'SKILL.md');
  const front = `---\nname: ${SKILL_NAME}\ndescription: ${SKILL_DESCRIPTION}\n---\n\n`;
  fs.writeFileSync(p, front + BODY);
  return { ok: true, name: SKILL_NAME, path: p };
}

// Detect target type heuristically from a path/extension.
function detectTarget(target) {
  const t = String(target || '').toLowerCase();
  if (/\.apk$/.test(t)) return 'apk';
  if (/\.asar$/.test(t)) return 'electron';
  if (/\.exe$|\.dll$|\.sys$/.test(t)) return 'pe';
  if (/\.dylib$|\.app\/|\.ipa$/.test(t) || process.platform === 'darwin') return 'macho';
  if (/\.pcap$|\.cap$/.test(t)) return 'network';
  if (/\.zip$|\.tar|\.gz$|\.bin$/.test(t)) return 'archive';
  if (/\.so$|\.o$/.test(t) || !path.extname(t)) return 'elf';
  return 'elf';
}

function reconFor(target) {
  const type = detectTarget(target);
  return { type, commands: RECON[type] || RECON.elf, traps: TRAPS };
}

function availableCommands() {
  const names = ['file', 'strings', 'objdump', 'readelf', 'nm', 'otool', 'tshark', 'binwalk', 'jadx', 'apktool', 'asar'];
  const out = {};
  for (const c of names) {
    const tool = process.platform === 'win32' ? 'where' : 'which';
    try { out[c] = spawnSync(tool, [c], { encoding: 'utf8', timeout: 2000 }).status === 0; }
    catch (e) { out[c] = false; }
  }
  return out;
}

function tools() {
  return [
    { name: 'leanrea_recon', description: 'Get the fastest CLI recon commands for a reverse-engineering target (no MCP layer).', inputSchema: { type: 'object', properties: { target: { type: 'string' } }, required: ['target'] } },
    { name: 'leanrea_skill', description: 'Read or install the lean-rea SKILL.md content.', inputSchema: { type: 'object', properties: { install: { type: 'boolean' } } } },
  ];
}

function dispatch(name, args) {
  args = args || {};
  if (name === 'leanrea_recon') return Object.assign({ ok: true, target: args.target }, reconFor(args.target));
  if (name === 'leanrea_skill') return args.install ? install() : Object.assign({ ok: true }, skill());
  throw new Error('unknown leanrea tool: ' + name);
}

module.exports = {
  SKILL_NAME, SKILL_DESCRIPTION, RECON, TRAPS, BODY,
  skill, install, detectTarget, reconFor, availableCommands, tools, dispatch,
};
