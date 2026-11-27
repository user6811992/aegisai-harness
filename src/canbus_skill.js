// src/canbus_skill.js
// CAN bus reverse-engineering methodology skill — zero new tools.
// Clean-room adaptation of ideas from linux-can/can-utils, collin80/SavvyCAN,
// cantools/cantools, and hardbyte/python-can. Teaches the agent which real CLI
// tools to run for automotive/CAN work instead of adding a tool layer.
// Hardware/network access is opt-in; nothing is bundled.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { DATA_DIR } = require('./core/config');

const SKILL_NAME = 'canbus-re';
const SKILL_DESCRIPTION = 'Reverse engineer CAN bus / automotive networks using plain CLI tools (candump, cansend, cantools, SavvyCAN) — no MCP layer.';

// Target/task -> fast CLI commands (fast path first)
const RECON = {
  sniff: [
    'candump can0 -L | head -50',
    'candump can0 -l                       # log to candump-YYYY-MM-DD.log',
    'timeout 10 candump can0 -L > /tmp/can_capture.log',
  ],
  decode: [
    'cantools decode tests/files/dbc/motohawk.dbc  "1f0#c001000000000000"',
    'cantools decode --single-line my.dbc "123#0102030405060708"',
    'cantools list -v my.dbc | head -60',
  ],
  inject: [
    'cansend can0 1f0#c001000000000000',
    'cantools encode my.dbc ExampleMessage Enable=1 Temperature=250.55',
  ],
  logformats: [
    '# SavvyCAN reads: BusMaster, Microchip, CRTD, GVRET, CSV, Vector, IXXAT, Vehicle Spy, candump/Kayak, PCAN, Wireshark PCAP',
    '# Convert candump -> CSV: candump2csv /tmp/capture.log > frames.csv',
    'tshark -r can_capture.pcap -Y can -T fields -e can.id -e can.data 2>/dev/null | head -40',
  ],
  interfaces: [
    'ip -details link show can0',
    'ip -stats -details link show can0',
    'canconfig can0 bitrate 500000 sample-point 0.875   # legacy; ip link set can0 up type can bitrate 500000',
  ],
  isotp: [
    '# ISO-TP (ISO 15765-2) for UDS diagnostics:',
    'isotpsend -s 7e0 -d 7e8 can0 -p 2 -D 1000',
    'isotprecv -s 7e8 -d 7e0 can0',
  ],
  uds: [
    '# UDS / OBD-II via python-can + isotp:',
    'python3 -c "import can,isotp; b=can.interface.Bus(\'can0\',interface=\'socketcan\'); print(b)"',
    'python3 -c "import cantools; db=cantools.database.load_file(\'vehicle.dbc\'); print(len(db.messages))"',
  ],
  gmlan: [
    '# GM seed/key, Nissan CRC examples in collin80 repos:',
    '# GMSeedKey: 16-bit seed/key challenge derivation',
    '# CRC_Nissan: CRC byte for Nissan Leaf CAN frames',
  ],
};

const TRAPS = [
  'Never inject onto a live vehicle bus without a safe bench/vegetable-climate setup — writes can affect real hardware.',
  'candump without -L prints Linux canonical format; with -L prints log format parseable by cantools/SavvyCAN.',
  'Bitrate/sample-point must match the bus exactly or you get "bus-off" and no frames.',
  'DBC signal endianness (byte_order) and scaling/offset matter — cantools applies them; raw hex does not.',
  'Extended (29-bit) IDs need the right DBC; a standard-ID decode of an extended frame will silently mislabel.',
  'ISO-TP and UDS need correct addressing (7e0/7e8 typical); wrong IDs give no response.',
  'Large candump logs flood context: use timeout + redirect to file, then rg/head — never paste the whole log.',
  'SavvyCAN is GUI/Qt; for agent workflows prefer CLI tools (candump/cantools/python-can) and use the GUI only for visualization.',
];

const BODY = `# ${SKILL_NAME} — CAN Bus Reverse Engineering

${SKILL_DESCRIPTION}

## Method
1. **Check the interface** (bitrate, state) before sniffing. Bring up a virtual can (vcan0) for safe practice.
2. **Sniff first, write never (initially)** — capture with \`candump -L\` to a file; never inject on a live bus until you know the protocol.
3. **Identify frames** — look at IDs and payload byte patterns; correlate with DBC if available.
4. **Decode with cantools** — apply DBC signals, scaling, endianness. Do not hand-decode when a DBC exists.
5. **Map the protocol** — group by ID, find periodic vs event-driven frames, identify ISO-TP/UDS channels.
6. **Only then consider injection** — on a bench, with exact IDs/payloads, one frame at a time.
7. **Report evidence** — frame IDs, DBC signal names, timing, and what is still unknown.

## Fast commands by task
${Object.entries(RECON).map(([k, cmds]) => `### ${k}\n${cmds.map((c) => '```bash\n' + c + '\n```').join('\n')}`).join('\n\n')}

## Known traps
${TRAPS.map((t) => '- ' + t).join('\n')}

## Rules
- Use the agent's existing shell tool. **No new tools are registered.**
- Safety first: sniff, decode, understand — then (on a bench) inject. Never on a live vehicle by default.
- Keep output small: redirect captures to files, inspect with head/rg.
- Prefer CLI over GUI for agent-driven work; SavvyCAN is for human visualization.
- Hardware access is opt-in and environment-dependent; if \`can0\` does not exist, say so and suggest vcan0.
`;

function skill() { return { name: SKILL_NAME, description: SKILL_DESCRIPTION, body: BODY }; }

function install() {
  const dir = path.join(DATA_DIR, 'skills', SKILL_NAME);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, 'SKILL.md');
  fs.writeFileSync(p, `---\nname: ${SKILL_NAME}\ndescription: ${SKILL_DESCRIPTION}\n---\n\n` + BODY);
  return { ok: true, name: SKILL_NAME, path: p };
}

function detectTask(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(decod|dbc|signal|cantools)\b/.test(t)) return 'decode';
  if (/\b(inject|send|write|cansend|encode)\b/.test(t)) return 'inject';
  if (/\b(uds|obd|diagnos|isotp|7e0|7e8)\b/.test(t)) return 'uds';
  if (/\b(pcap|wireshark|log format|savvycan|csv)\b/.test(t)) return 'logformats';
  if (/\b(bitrate|interface|can0|vcan|bus-off)\b/.test(t)) return 'interfaces';
  if (/\b(seed|key|crc|gmlan|nissan|gm)\b/.test(t)) return 'gmlan';
  if (/\b(isotp|iso-tp)\b/.test(t)) return 'isotp';
  return 'sniff';
}

function reconFor(task) {
  const type = detectTask(task);
  return { type, commands: RECON[type] || RECON.sniff, traps: TRAPS };
}

function availableCommands() {
  const names = ['candump', 'cansend', 'cantools', 'isotpsend', 'isotprecv', 'ip'];
  const out = {};
  for (const c of names) {
    const tool = process.platform === 'win32' ? 'where' : 'which';
    try { out[c] = spawnSync(tool, [c], { encoding: 'utf8', timeout: 2000 }).status === 0; }
    catch (e) { out[c] = false; }
  }
  try { out.can0 = fs.existsSync('/sys/class/net/can0'); } catch (e) { out.can0 = false; }
  return out;
}

function tools() {
  return [
    { name: 'canbus_recon', description: 'Get fast CLI commands for a CAN bus RE task (sniff/decode/inject/UDS).', inputSchema: { type: 'object', properties: { task: { type: 'string' } } } },
    { name: 'canbus_skill', description: 'Read or install the canbus-re SKILL.md content.', inputSchema: { type: 'object', properties: { install: { type: 'boolean' } } } },
  ];
}

function dispatch(name, args) {
  args = args || {};
  if (name === 'canbus_recon') return Object.assign({ ok: true, task: args.task }, reconFor(args.task));
  if (name === 'canbus_skill') return args.install ? install() : Object.assign({ ok: true }, skill());
  throw new Error('unknown canbus tool: ' + name);
}

module.exports = {
  SKILL_NAME, SKILL_DESCRIPTION, RECON, TRAPS, BODY,
  skill, install, detectTask, reconFor, availableCommands, tools, dispatch,
};
