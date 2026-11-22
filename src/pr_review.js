// src/pr_review.js
// PR review agent with dry-run default and inline comments (opencomputer-example-pr-review).
const { runAgent } = require('./agent/run');

async function review(diff, opts) {
  opts = opts || {};
  const dryRun = opts.dryRun !== false;
  const prompt = 'Review this pull request diff. Report concrete issues with file and line references. Be concise.\n\n' + String(diff).slice(0, 6000);
  const r = await runAgent({ model: opts.model || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: prompt }], projectRoot: opts.projectRoot || process.cwd(), autoApprove: true, onEvent: () => {} });
  const text = (r.final && r.final.final) || '';
  const comments = parseInlineComments(text);
  return { ok: true, dryRun, summary: text.slice(0, 2000), comments, posted: dryRun ? false : !!opts.client, note: dryRun ? 'dry-run: nothing posted' : (opts.client ? 'posted' : 'no client configured') };
}
function parseInlineComments(text) {
  const out = [];
  const re = /([\w./-]+):(\d+)\s*[-:]?\s*(.+)/g;
  let m;
  while ((m = re.exec(text || '')) && out.length < 30) out.push({ path: m[1], line: Number(m[2]), body: m[3].slice(0, 300) });
  return out;
}

module.exports = { review, parseInlineComments };
