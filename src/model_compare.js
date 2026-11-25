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

// Pairwise similarity matrix + per-response token counts, for the comparison UI.
function analyze(comparison) {
  const { similarity } = require('./text_diff');
  const ok = (comparison.results || []).filter((r) => r.ok);
  const pairs = [];
  for (let i = 0; i < ok.length; i++) {
    for (let j = i + 1; j < ok.length; j++) {
      pairs.push({ a: ok[i].model, b: ok[j].model, similarity: +similarity(ok[i].reply, ok[j].reply).toFixed(3) });
    }
  }
  return {
    pairs,
    lengths: ok.map((r) => ({ model: r.model, chars: (r.reply || '').length, words: (r.reply || '').split(/\s+/).filter(Boolean).length, duration: r.duration })),
    agreement: pairs.length ? +(pairs.reduce((s, p) => s + p.similarity, 0) / pairs.length).toFixed(3) : null,
  };
}

// Multi-run A/B test: N repetitions per model, pass rate, latency stats, and
// a pairwise comparison with a normal-approximation z score.
async function abTest(prompt, models, opts) {
  opts = opts || {};
  const runs = Math.max(1, opts.runs || 3);
  const check = opts.check || null; // (reply) => boolean
  const { runAgent } = require('./agent/run');
  const arms = [];
  for (const model of models) {
    const samples = [];
    for (let i = 0; i < runs; i++) {
      const started = Date.now();
      let reply = '';
      let ok = true;
      let error = null;
      try {
        const r = await runAgent({
          model,
          messages: [{ role: 'user', content: prompt }],
          projectRoot: opts.projectRoot || process.cwd(),
          onEvent: () => {},
          autoApprove: Boolean(opts.autoApprove),
        });
        reply = (r.final && r.final.final) || '';
      } catch (e) { ok = false; error = String((e && e.message) || e); }
      const duration = Date.now() - started;
      const passed = ok && (check ? Boolean(check(reply)) : true);
      samples.push({ ok: passed, duration, chars: reply.length, error });
    }
    const durations = samples.map((s) => s.duration).sort((a, b) => a - b);
    const passes = samples.filter((s) => s.ok).length;
    arms.push({
      model,
      runs,
      passes,
      passRate: +(passes / runs).toFixed(3),
      meanDuration: Math.round(samples.reduce((a, s) => a + s.duration, 0) / runs),
      medianDuration: durations[Math.floor(durations.length / 2)] || 0,
      meanChars: Math.round(samples.reduce((a, s) => a + s.chars, 0) / runs),
      samples,
    });
  }
  // Pairwise: z-test on pass proportions (normal approximation).
  const comparisons = [];
  for (let i = 0; i < arms.length; i++) {
    for (let j = i + 1; j < arms.length; j++) {
      const a = arms[i]; const b = arms[j];
      const p1 = a.passRate; const p2 = b.passRate;
      const pooled = (a.passes + b.passes) / (a.runs + b.runs);
      const se = Math.sqrt(pooled * (1 - pooled) * (1 / a.runs + 1 / b.runs)) || 0;
      const z = se ? +(((p1 - p2) / se).toFixed(2)) : 0;
      comparisons.push({
        a: a.model, b: b.model, deltaPassRate: +(p1 - p2).toFixed(3), z,
        significant: Math.abs(z) >= 1.96,
        faster: a.meanDuration <= b.meanDuration ? a.model : b.model,
      });
    }
  }
  return { prompt, runs, arms, comparisons, best: arms.slice().sort((x, y) => (y.passRate - x.passRate) || (x.meanDuration - y.meanDuration))[0] };
}

module.exports = { compare, formatComparison, analyze, abTest };
