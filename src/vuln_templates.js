// src/vuln_templates.js
// Nuclei-style YAML template scanner (subset): request templates with matchers.
// Supports: http GET/POST, status/word/regex matchers, and `extractors` (regex).
const fs = require('fs');
const path = require('path');
const yaml = require('./yaml_lite');

function asArray(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); }

function parseTemplate(text) {
  const doc = yaml.parse(text) || {};
  const requests = asArray(doc.requests || doc.http || doc['http-requests'] || []);
  const reqs = requests.map((r) => {
    const matchers = asArray(r.matchers || r['matchers-condition'] ? r.matchers : r.matchers);
    return {
      method: String(r.method || 'GET').toUpperCase(),
      path: asArray(r.path || r.paths || ['{{BaseURL}}']),
      headers: r.headers || {},
      body: r.body || null,
      matchers: asArray(r.matchers).map((m) => ({
        type: m.type || 'word',
        words: asArray(m.words || m.word),
        regex: asArray(m.regex),
        status: asArray(m.status),
        part: m.part || 'body',
        condition: m.condition || 'or',
        negative: Boolean(m.negative),
      })),
      matchersCondition: r['matchers-condition'] || 'or',
      extractors: asArray(r.extractors).map((e) => ({ type: e.type || 'regex', regex: asArray(e.regex), group: e.group || 1 })),
    };
  });
  return {
    id: doc.id || path.basename('template'),
    info: doc.info || {},
    requests: reqs,
  };
}

function loadTemplates(dir) {
  const out = [];
  const walk = (d) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ya?ml)$/i.test(e.name)) {
        try { out.push(parseTemplate(fs.readFileSync(p, 'utf8'))); } catch (err) {}
      }
    }
  };
  walk(dir);
  return out;
}

function substitute(s, vars) {
  return String(s || '').replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
}

function matchOne(matcher, res, body) {
  const target = matcher.part === 'header' ? JSON.stringify(res.headers || {}) : body;
  let hit = false;
  if (matcher.type === 'status') hit = matcher.status.map(Number).includes(Number(res.status));
  else if (matcher.type === 'regex') hit = matcher.regex.some((r) => { try { return new RegExp(r).test(target); } catch (e) { return false; } });
  else hit = matcher.words.some((w) => target.includes(substitute(w, {})));
  return matcher.negative ? !hit : hit;
}

async function runTemplate(tpl, baseUrl, opts) {
  opts = opts || {};
  const results = [];
  for (const req of tpl.requests) {
    for (const rawPath of req.path) {
      const target = substitute(rawPath, { BaseURL: baseUrl, Hostname: (() => { try { return new URL(baseUrl).hostname; } catch (e) { return baseUrl; } })() });
      let res;
      try {
        res = await fetch(target, {
          method: req.method,
          headers: req.headers,
          body: req.method === 'GET' ? undefined : (req.body || undefined),
          signal: AbortSignal.timeout(opts.timeoutMs || 10000),
          redirect: 'follow',
        });
      } catch (e) {
        results.push({ templateId: tpl.id, target, error: String((e && e.message) || e), matched: false });
        continue;
      }
      let body = '';
      try { body = await res.text(); } catch (e) { body = ''; }
      const matcherHits = req.matchers.map((m) => matchOne(m, { status: res.status, headers: Object.fromEntries(res.headers.entries()) }, body));
      const matched = req.matchersCondition === 'and'
        ? matcherHits.length > 0 && matcherHits.every(Boolean)
        : matcherHits.some(Boolean);
      const extracted = [];
      for (const ex of req.extractors) {
        for (const r of ex.regex) {
          try {
            const re = new RegExp(r, 'g');
            let m;
            let guard = 0;
            while ((m = re.exec(body)) !== null && guard++ < 50) extracted.push(m[ex.group] || m[0]);
          } catch (e) {}
        }
      }
      results.push({ templateId: tpl.id, severity: (tpl.info && tpl.info.severity) || 'info', name: (tpl.info && tpl.info.name) || tpl.id, target, status: res.status, matched, extracted: extracted.slice(0, 20) });
    }
  }
  return results;
}

async function run(templates, target, opts) {
  const all = [];
  for (const t of templates) all.push(...await runTemplate(t, target, opts));
  return {
    target,
    templates: templates.length,
    requests: all.length,
    matches: all.filter((r) => r.matched),
    results: all,
    summary: { matched: all.filter((r) => r.matched).length, checked: all.length, verdict: all.some((r) => r.matched) ? 'findings' : 'clean' },
  };
}

function toSarif(report) {
  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: { driver: { name: 'aegisai-vuln-templates' } },
      results: report.matches.map((m) => ({
        ruleId: 'template/' + m.templateId,
        level: m.severity === 'critical' || m.severity === 'high' ? 'error' : 'warning',
        message: { text: (m.name || m.templateId) + ' matched at ' + m.target + ' (HTTP ' + m.status + ')' },
        locations: [{ physicalLocation: { artifactLocation: { uri: m.target } } }],
      })),
    }],
  };
}

module.exports = { parseTemplate, loadTemplates, runTemplate, run, toSarif, substitute };
