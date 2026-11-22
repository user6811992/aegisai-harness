// src/silent_failure.js
// Detect silent failures: tool reported success but outcome contradicts evidence.
function detect(finalText, toolLog) {
  const text = String(finalText || '').toLowerCase();
  const flags = [];
  for (const t of toolLog || []) {
    const out = String(t.resultPreview || '').toLowerCase();
    const reportedOk = t.result && t.result.ok === true;
    if (reportedOk && /error|fail|traceback|not found|no such/.test(out)) flags.push({ tool: t.name, reason: 'ok=true but output contains error indicators', preview: out.slice(0, 100) });
    if (reportedOk && /0 files|0 matches|empty|\(no /.test(out) && /wrote|created|added|found/i.test(text)) flags.push({ tool: t.name, reason: 'claims change but tool saw no effect' });
  }
  return { silentFailure: flags.length > 0, flags };
}

module.exports = { detect };
