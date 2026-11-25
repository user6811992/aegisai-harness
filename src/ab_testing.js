// src/ab_testing.js
// Multi-model A/B testing across repeated runs.
// Runs each (model, prompt) pair N times, computes pass rate, median latency,
// and a pairwise significance (sign test) between the top two models.
const { compare } = require('./model_compare');

function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}

// passFn: (result) -> boolean. Default: reply non-empty and no error.
function defaultPass(r) { return Boolean(r.ok && r.reply && r.reply.trim().length > 0); }

async function run(opts) {
  opts = opts || {};
  const prompts = opts.prompts || [opts.prompt || ''];
  const models = opts.models || [];
  const trials = Math.max(1, opts.trials || 3);
  const passFn = opts.passFn || defaultPass;
  const projectRoot = opts.projectRoot || process.cwd();

  const runs = []; // { model, prompt, trial, ok, pass, duration, reply, error }
  for (const model of models) {
    for (const prompt of prompts) {
      for (let t = 0; t < trials; t++) {
        const started = Date.now();
        try {
          const r = await require('./model_compare').compare(prompt, [model], { projectRoot, tokenBudget: opts.tokenBudget || 0 });
          const res = (r.results || [])[0] || {};
          runs.push({
            model, prompt, trial: t,
            ok: Boolean(res.ok),
            pass: passFn(res),
            duration: res.duration || (Date.now() - started),
            reply: res.reply || '',
            error: res.error || null,
            tokenStats: res.tokenStats || null,
          });
        } catch (e) {
          runs.push({ model, prompt, trial: t, ok: false, pass: false, duration: Date.now() - started, reply: '', error: String(e.message || e) });
        }
      }
    }
  }

  // Aggregate per (model, prompt).
  const groups = {};
  for (const r of runs) {
    const key = r.model + '\u0000' + r.prompt;
    if (!groups[key]) groups[key] = { model: r.model, prompt: r.prompt, runs: [] };
    groups[key].runs.push(r);
  }
  const aggregates = Object.values(groups).map((g) => {
    const passes = g.runs.filter((r) => r.pass).length;
    const lats = g.runs.map((r) => r.duration);
    return {
      model: g.model,
      prompt: g.prompt,
      trials: g.runs.length,
      passes,
      passRate: +(passes / g.runs.length).toFixed(3),
      medianLatency: median(lats),
      p95Latency: percentile(lats, 95),
      meanLatency: Math.round(lats.reduce((a, b) => a + b, 0) / (lats.length || 1)),
      failures: g.runs.filter((r) => !r.ok).length,
      errors: g.runs.map((r) => r.error).filter(Boolean),
    };
  });

  // Overall per model (across prompts).
  const perModel = {};
  for (const m of models) {
    const rs = runs.filter((r) => r.model === m);
    const passes = rs.filter((r) => r.pass).length;
    perModel[m] = {
      trials: rs.length,
      passes,
      passRate: rs.length ? +(passes / rs.length).toFixed(3) : 0,
      medianLatency: median(rs.map((r) => r.duration)),
      p95Latency: percentile(rs.map((r) => r.duration), 95),
    };
  }

  // Significance: pairwise sign test between the top two models on shared prompts.
  const significance = [];
  if (models.length >= 2) {
    const [a, b] = models.slice(0, 2);
    const sharedPrompts = prompts;
    let aWins = 0, bWins = 0, ties = 0;
    for (const prompt of sharedPrompts) {
      for (let t = 0; t < trials; t++) {
        const ra = runs.find((r) => r.model === a && r.prompt === prompt && r.trial === t);
        const rb = runs.find((r) => r.model === b && r.prompt === prompt && r.trial === t);
        if (!ra || !rb) continue;
        if (ra.pass && !rb.pass) aWins++;
        else if (!ra.pass && rb.pass) bWins++;
        else if (ra.duration < rb.duration && ra.pass === rb.pass) aWins++;
        else if (rb.duration < ra.duration && ra.pass === rb.pass) bWins++;
        else ties++;
      }
    }
    const n = aWins + bWins;
    // Two-sided binomial sign test (p = 0.5).
    let p = 1;
    if (n > 0) {
      let cum = 0;
      const k = Math.min(aWins, bWins);
      for (let i = 0; i <= k; i++) {
        cum += comb(n, i) * Math.pow(0.5, n);
      }
      p = Math.min(1, 2 * cum);
    }
    significance.push({ a, b, aWins, bWins, ties, pValue: +p.toFixed(4), significant: p < 0.05 });
  }

  // Winner = highest pass rate, then lowest median latency.
  const winner = Object.keys(perModel).sort((x, y) => {
    if (perModel[y].passRate !== perModel[x].passRate) return perModel[y].passRate - perModel[x].passRate;
    return perModel[x].medianLatency - perModel[y].medianLatency;
  })[0] || null;

  return {
    prompts, models, trials, winner,
    perModel, aggregates, significance, runs: opts.includeRuns ? runs : undefined,
    summary: {
      trials: runs.length,
      winner,
      winnerPassRate: winner ? perModel[winner].passRate : null,
    },
  };
}

function comb(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - i + 1)) / i;
  return r;
}

function format(result) {
  const lines = [];
  lines.push('# A/B Test Results');
  lines.push('');
  lines.push('**Prompts:** ' + result.prompts.length + '  |  **Models:** ' + result.models.join(', ') + '  |  **Trials:** ' + result.trials);
  lines.push('**Winner:** ' + (result.winner || 'n/a') + (result.summary.winnerPassRate != null ? ' (pass rate ' + (result.summary.winnerPassRate * 100).toFixed(0) + '%)' : ''));
  lines.push('');
  lines.push('## Per model');
  for (const m of result.models) {
    const a = result.perModel[m];
    lines.push('- **' + m + '**: pass ' + (a.passRate * 100).toFixed(0) + '% (' + a.passes + '/' + a.trials + '), median ' + a.medianLatency + ' ms, p95 ' + a.p95Latency + ' ms');
  }
  if (result.significance.length) {
    lines.push('');
    lines.push('## Significance');
    for (const s of result.significance) {
      lines.push('- ' + s.a + ' vs ' + s.b + ': ' + s.aWins + '–' + s.bWins + ' (ties ' + s.ties + '), p=' + s.pValue + (s.significant ? ' (significant)' : ' (not significant)'));
    }
  }
  lines.push('');
  lines.push('## Per (model, prompt)');
  for (const a of result.aggregates) {
    lines.push('- **' + a.model + '** on `' + a.prompt.slice(0, 60) + '` → ' + (a.passRate * 100).toFixed(0) + '% pass, median ' + a.medianLatency + ' ms');
  }
  return lines.join('\n');
}

module.exports = { run, format, median, percentile, defaultPass };
