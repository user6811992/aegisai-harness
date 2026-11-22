// src/hunt.js
// Bug-hunting integration: hunt session start, disclosed-vulnerability pattern lookup, report rendering (aegisai-next server/integrations/hunt.js).
const vulnPatterns = require('./vuln_patterns');

const hunts = new Map();
const reports = [];
let huntSeq = 0;

function renderReport(findings, opts) {
  opts = opts || {};
  const title = (opts.title || (findings && findings[0] && findings[0].title) || 'Bug Hunt Report');
  const lines = ['# ' + title, '', '## Findings'];
  if (!Array.isArray(findings) || findings.length === 0) { lines.push('', '_No findings recorded._', ''); return lines.join('\n'); }
  findings.forEach((f, i) => {
    lines.push('', '### ' + (i + 1) + '. ' + (f.title || 'Finding ' + (i + 1)), '');
    if (f.severity) lines.push('- Severity: ' + f.severity);
    if (f.cwe) lines.push('- CWE: ' + f.cwe);
    if (f.description) lines.push('- Description: ' + f.description);
    if (f.evidence) lines.push('- Evidence: ' + f.evidence);
    if (f.remediation) lines.push('- Remediation: ' + f.remediation);
  });
  lines.push('', '## Summary', '', (findings.length) + ' finding(s) recorded.');
  return lines.join('\n');
}
function start(target, scope, maxSteps) {
  const t = String(target || '').trim();
  if (!t) return { ok: false, error: 'target required' };
  const id = 'hunt-' + (++huntSeq);
  hunts.set(id, { id, target: t, scope: scope || '', maxSteps: maxSteps || 50, status: 'started', steps: [], findings: [], createdAt: Date.now() });
  return { ok: true, result: { huntId: id, target: t, status: 'started' } };
}
function vulnSearch(query, limit) {
  const patterns = vulnPatterns.searchPatterns(String(query || ''), { limit: limit || 20 });
  return { ok: true, result: { patterns } };
}
function report(findings, title, huntId) {
  const f = Array.isArray(findings) ? findings : [];
  const t = title || (f[0] && f[0].title) || 'Bug Hunt Report';
  const md = renderReport(f, { title: t });
  const sid = huntId || ([...hunts.values()].sort((a, b) => b.createdAt - a.createdAt)[0] || {}).id;
  if (sid) { const s = hunts.get(sid); if (s) { s.report = md; s.findings = f; s.status = 'reported'; s.updatedAt = Date.now(); } }
  const rid = 'rpt-' + (++huntSeq);
  reports.push({ id: rid, huntId: sid, title: t, report: md, createdAt: Date.now() });
  return { ok: true, result: { reportId: rid, huntId: sid, report: md, status: 'reported' } };
}
function list() { return reports.map((r) => ({ id: r.id, huntId: r.huntId, title: r.title, createdAt: r.createdAt })); }

module.exports = { start, vulnSearch, report, list, renderReport, hunts, reports };
