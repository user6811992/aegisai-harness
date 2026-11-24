// src/model_compare.js
// Multi-model comparison: send the same prompt to multiple models and compare responses.
const { runAgent } = require('./agent/run');

async function compare(prompt, models, opts) {
  opts = opts || {};
  const projectRoot = opts.projectRoot || process.cwd();
  const results = [];
  for (const model of models) {
    const start = Date.now();
    try {
      const r = await runAgent({
        model,
        messages: [{ role: 'user', content: prompt }],
        projectRoot,
        onEvent: () => {},
        autoApprove: true,
        tokenBudgetTotal: opts.tokenBudget || 0,
      });
      const duration = Date.now() - start;
      results.push({
        model,
        ok: true,
        reply: (r.final && r.final.final) || '',
        toolLog: r.toolLog || [],
        tokenStats: r.final && r.final.tokenStats,
        duration,
      });
    } catch (e) {
      results.push({ model, ok: false, error: String(e.message || e), duration: Date.now() - start });
    }
  }
  return {
    prompt,
    models,
    results,
    fastest: results.filter((r) => r.ok).sort((a, b) => a.duration - b.duration)[0]?.model,
    shortest: results.filter((r) => r.ok).sort((a, b) => (a.reply || '').length - (b.reply || '').length)[0]?.model,
    longest: results.filter((r) => r.ok).sort((a, b) => (b.reply || '').length - (a.reply || '').length)[0]?.model,
  };
}

function formatComparison(comparison) {
  const lines = [];
  lines.push('# Multi-Model Comparison');
  lines.push('');
  lines.push('**Prompt:** ' + comparison.prompt);
  lines.push('');
  lines.push('**Models:** ' + comparison.models.join(', '));
  lines.push('');
  for (const r of comparison.results) {
    lines.push('## ' + r.model);
    lines.push('');
    if (r.ok) {
      lines.push(r.reply);
      lines.push('');
      lines.push(`_Duration: ${r.duration}ms | Tokens: ${r.tokenStats ? r.tokenStats.total : 'N/A'} | Tools: ${r.toolLog.length}_`);
    } else {
      lines.push('**Error:** ' + r.error);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  if (comparison.fastest) lines.push('**Fastest:** ' + comparison.fastest);
  if (comparison.shortest) lines.push('**Shortest response:** ' + comparison.shortest);
  if (comparison.longest) lines.push('**Longest response:** ' + comparison.longest);
  return lines.join('\n');
}

module.exports = { compare, formatComparison };
