// src/eval.js
// Simple agent eval harness with rubrics.
const db = require('./storage/db');
const { runAgent } = require('./agent/run');
const profiles = require('./agents/profiles');

function addEval(name, prompt, expected, agent, expectedTools, expectedStateValue, expectedState) {
  const id = 'eval_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  try {
    db.get().prepare('INSERT INTO evals (id, name, prompt, expected, agent, created, expected_tools, expected_state_value, expected_state) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, name, prompt, expected || '', agent || 'default', new Date().toISOString(), expectedTools ? JSON.stringify(expectedTools) : null, expectedStateValue || null, expectedState ? JSON.stringify(expectedState) : null);
  } catch (e) {
    try {
      db.get().prepare('INSERT INTO evals (id, name, prompt, expected, agent, created, expected_tools, expected_state_value) VALUES (?,?,?,?,?,?,?,?)')
        .run(id, name, prompt, expected || '', agent || 'default', new Date().toISOString(), expectedTools ? JSON.stringify(expectedTools) : null, expectedStateValue || null);
    } catch (e2) {
      db.get().prepare('INSERT INTO evals (id, name, prompt, expected, agent, created) VALUES (?,?,?,?,?,?)')
        .run(id, name, prompt, expected || '', agent || 'default', new Date().toISOString());
    }
  }
  return id;
}

function listEvals() {
  try { return db.get().prepare('SELECT * FROM evals ORDER BY created DESC').all(); }
  catch (e) { return db.all('SELECT * FROM evals ORDER BY created DESC'); }
}

async function runEvals(opts) {
  opts = opts || {};
  const cases = listEvals();
  const results = [];
  for (const c of cases) {
    const profile = profiles.getProfile(c.agent || 'default');
    const res = await runAgent({
      model: opts.model || profile.model || process.env.AEGISAI_MODEL || 'llama3.2:3b',
      messages: [{ role: 'system', content: profile.systemPrompt }, { role: 'user', content: c.prompt }],
      projectRoot: opts.projectRoot || process.cwd(),
      includeCoding: profile.includeCoding !== false,
      cleanRoom: profile.cleanRoom,
      allowedTools: profile.allowedTools,
      deniedTools: profile.deniedTools,
      sandbox: profile.sandbox,
      autoApprove: true,
    });
    const out = (res.final && res.final.final) || '';
    const toolNames = (res.toolLog || []).map((t) => t.name);
    const expected = (c.expected || '').toLowerCase();
    let pass = expected ? out.toLowerCase().includes(expected) : true;
    // tool-sequence grading
    let expectedTools = [];
    try { expectedTools = c.expected_tools ? JSON.parse(c.expected_tools) : []; } catch (e) { expectedTools = []; }
    if (expectedTools.length > 0) {
      let i = 0;
      for (const tn of toolNames) {
        if (i < expectedTools.length && tn === expectedTools[i]) i += 1;
      }
      const seqPass = i === expectedTools.length;
      pass = pass && seqPass;
    }
    // state-diff grading: check set_state calls
    if (c.expected_state_value) {
      const stateCalls = (res.toolLog || []).filter((t) => (t.name || '').endsWith('set_state'));
      const statePass = stateCalls.some((t) => {
        const v = t.args && t.args.value;
        return v === c.expected_state_value;
      });
      pass = pass && statePass;
    }
    // full state-diff grading via MOCK_STATE_FILE
    if (c.expected_state) {
      let expectedState = {};
      try { expectedState = JSON.parse(c.expected_state); } catch (e) { expectedState = {}; }
      const sf = process.env.MOCK_STATE_FILE;
      if (sf && require('fs').existsSync(sf)) {
        try {
          const actual = JSON.parse(require('fs').readFileSync(sf, 'utf8'));
          const statePass = Object.keys(expectedState).every((k) => JSON.stringify(actual[k]) === JSON.stringify(expectedState[k]));
          pass = pass && statePass;
        } catch (e) { pass = false; }
      }
    }
    results.push({ id: c.id, name: c.name, pass, output: out.slice(0, 300), toolNames });
  }
  const passed = results.filter((r) => r.pass).length;
  return { total: results.length, passed, failed: results.length - passed, results };
}

module.exports = { addEval, listEvals, runEvals };
