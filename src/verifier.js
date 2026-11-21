// src/verifier.js
// Independent verification of work: check claims against tool-log evidence.
function verify(finalText, toolLog) {
  const text = (finalText || '').toLowerCase();
  const log = toolLog || [];
  const claims = [];
  if (/tests? pass|all tests|test suite/i.test(finalText || '')) claims.push('tests passed');
  if (/done|complete|finished|implemented/i.test(finalText || '')) claims.push('work complete');
  if (/fixed|resolved/i.test(finalText || '')) claims.push('issue fixed');

  const evidence = [];
  for (const t of log) {
    if (t.name === 'run_command' || t.name === 'run_python') {
      const out = String(t.resultPreview || '').toLowerCase();
      if (/pass|ok|success|0 failures/.test(out)) evidence.push('command output suggests success');
      if (/fail|error|traceback/.test(out)) evidence.push('command output suggests failure');
    }
    if (t.name === 'write_file' || t.name === 'delete_file') evidence.push('file change made');
  }

  const issues = [];
  if (claims.includes('tests passed') && !evidence.some((e) => e.includes('command output suggests success'))) issues.push('no test-run evidence');
  if (claims.includes('work complete') && !log.some((t) => t.name === 'write_file' || t.name === 'delete_file' || t.name === 'run_command')) issues.push('no change evidence');

  return { verified: issues.length === 0, claims, evidence, issues };
}

function verifyFiles(claims, toolLog, projectRoot) {
  const fs = require('fs');
  const path = require('path');
  const root = projectRoot || process.cwd();
  const out = [];
  for (const c of claims || []) {
    const pathVal = c.path || c.file;
    if (!pathVal) continue;
    const p = path.isAbsolute(pathVal) ? pathVal : path.join(root, pathVal);
    const exists = fs.existsSync(p);
    let contentOk = true;
    if (exists && c.contains) {
      try { contentOk = fs.readFileSync(p, 'utf8').includes(c.contains); } catch (e) { contentOk = false; }
    }
    out.push({ path: pathVal, exists, contentOk, verified: exists && contentOk });
  }
  return { verified: out.length > 0 && out.every((o) => o.verified), files: out };
}

module.exports = { verify, verifyFiles };
