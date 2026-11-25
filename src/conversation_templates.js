// src/conversation_templates.js
// Reusable prompt/workflow templates for the chat UI and REPL.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

const BUILTIN = [
  {
    id: 'code-review',
    name: 'Code review',
    category: 'code',
    description: 'Review the current diff for correctness, security, and style.',
    body: 'Review the current changes.\n\nFocus on:\n1. Correctness and edge cases\n2. Security (injection, secrets, unsafe paths)\n3. Consistency with the surrounding code\n4. Tests that should exist\n\nReport findings as a short list with file:line references, then a verdict.',
  },
  {
    id: 'bug-triage',
    name: 'Bug triage',
    category: 'debug',
    description: 'Reproduce, isolate, and propose a minimal fix.',
    body: 'Help me triage this bug:\n\n{{symptom}}\n\n1. Restate the expected vs actual behaviour.\n2. List the most likely causes, cheapest to test first.\n3. Propose the smallest experiment that distinguishes them.\n4. Once confirmed, propose a minimal fix and a regression test.',
  },
  {
    id: 'refactor',
    name: 'Refactor safely',
    category: 'code',
    description: 'Refactor with a verification step after each change.',
    body: 'Refactor {{target}} without changing behaviour.\n\nRules:\n- One logical change at a time.\n- Run the relevant tests after each step.\n- Stop and report if a step cannot be verified.\n\nFinish with a summary of what moved and why.',
  },
  {
    id: 'test-plan',
    name: 'Test plan',
    category: 'quality',
    description: 'Derive a test plan from a feature description.',
    body: 'Produce a test plan for: {{feature}}\n\nInclude happy paths, boundary cases, failure modes, and the cheapest way to cover each. Mark which are unit vs integration.',
  },
  {
    id: 'security-audit',
    name: 'Security audit',
    category: 'security',
    description: 'Structured audit with verification of each finding.',
    body: 'Audit {{target}} for security issues.\n\nPhases:\n1. Recon — map the entry points.\n2. Candidates — list suspected issues with evidence.\n3. Verify — re-check each candidate independently; drop anything you cannot reproduce.\n4. Report — only confirmed issues, each with file:line, impact, and a fix.',
  },
  {
    id: 'docs',
    name: 'Write docs',
    category: 'docs',
    description: 'Generate reference docs for a module.',
    body: 'Write reference documentation for {{module}}.\n\nCover purpose, public API with signatures, configuration, failure modes, and one runnable example. Keep it terse.',
  },
  {
    id: 'release-notes',
    name: 'Release notes',
    category: 'docs',
    description: 'Summarise changes since a tag.',
    body: 'Write release notes since {{tag}}.\n\nGroup into Added / Changed / Fixed / Security. One line per user-visible change. Call out breaking changes first.',
  },
  {
    id: 'debug-runtime',
    name: 'Runtime debugging',
    category: 'debug',
    description: 'Instrument, reproduce, then fix.',
    body: 'Debug this runtime failure: {{error}}\n\n1. Reproduce it deterministically.\n2. Add the minimum instrumentation needed to see the state.\n3. Identify the first point where reality diverges from expectation.\n4. Fix that point only, then re-run.',
  },
  {
    id: 'perf-profile',
    name: 'Performance profiling',
    category: 'perf',
    description: 'Profile and optimize a hot path.',
    body: 'Profile this code path: {{path}}\n\n1. Identify the bottleneck (CPU, I/O, memory, or lock contention).\n2. Measure baseline (time, allocations, throughput).\n3. Propose the smallest change that improves the metric.\n4. Re-measure and report before/after.',
  },
  {
    id: 'api-design',
    name: 'API design',
    category: 'design',
    description: 'Design a new API endpoint.',
    body: 'Design an API for: {{feature}}\n\n1. List the use cases and callers.\n2. Define the request/response schema.\n3. Consider error cases and status codes.\n4. Plan versioning and backward compatibility.\n5. Write a minimal example request/response.',
  },
  {
    id: 'migration-plan',
    name: 'Migration plan',
    category: 'ops',
    description: 'Plan a database or API migration.',
    body: 'Plan a migration for: {{change}}\n\n1. Assess current state and dependencies.\n2. Design the migration steps (forward + rollback).\n3. Identify risks and mitigation.\n4. Estimate downtime and data volume.\n5. Write a runbook with checkpoints.',
  },
  {
    id: 'incident-response',
    name: 'Incident response',
    category: 'ops',
    description: 'Respond to a production incident.',
    body: 'Incident: {{description}}\n\n1. Assess severity and impact.\n2. Identify the root cause (logs, metrics, traces).\n3. Apply the fastest mitigation.\n4. Communicate status to stakeholders.\n5. Write a post-mortem with action items.',
  },
  {
    id: 'dependency-upgrade',
    name: 'Dependency upgrade',
    category: 'maintenance',
    description: 'Plan and execute a dependency upgrade.',
    body: 'Upgrade {{package}} from {{from}} to {{to}}\n\n1. Check changelog for breaking changes.\n2. Update the dependency and lockfile.\n3. Run tests and fix failures.\n4. Check for deprecation warnings.\n5. Verify no new vulnerabilities.',
  },
  {
    id: 'onboarding-guide',
    name: 'Onboarding guide',
    category: 'docs',
    description: 'Create an onboarding guide for new developers.',
    body: 'Create an onboarding guide for: {{project}}\n\n1. Prerequisites and setup steps.\n2. Project structure overview.\n3. Key concepts and architecture.\n4. Common workflows and commands.\n5. Troubleshooting tips.',
  },
  {
    id: 'pr-description',
    name: 'PR description',
    category: 'git',
    description: 'Write a pull request description.',
    body: 'Write a PR description for: {{change}}\n\n## Summary\nBrief description of the change.\n\n## Changes\n- List of specific changes\n\n## Testing\n- How to test\n\n## Checklist\n- [ ] Tests pass\n- [ ] Docs updated\n- [ ] No breaking changes',
  },
  {
    id: 'error-analysis',
    name: 'Error analysis',
    category: 'debug',
    description: 'Analyze an error and propose fixes.',
    body: 'Analyze this error: {{error}}\n\n1. Parse the stack trace.\n2. Identify the root cause.\n3. List possible fixes (simplest first).\n4. Recommend the best fix with rationale.\n5. Suggest a regression test.',
  },
  {
    id: 'refactor-plan',
    name: 'Refactor plan',
    category: 'code',
    description: 'Plan a code refactoring.',
    body: 'Refactor: {{target}}\n\n1. Identify code smells and technical debt.\n2. Define the desired end state.\n3. Plan incremental steps (each independently testable).\n4. Identify risks and rollback strategy.\n5. Estimate effort.',
  },
  {
    id: 'test-coverage',
    name: 'Test coverage',
    category: 'test',
    description: 'Improve test coverage for a module.',
    body: 'Improve test coverage for: {{module}}\n\n1. Identify untested code paths.\n2. List edge cases and boundary conditions.\n3. Write tests for each gap.\n4. Verify coverage improvement.\n5. Check for flaky tests.',
  },
  {
    id: 'accessibility-audit',
    name: 'Accessibility audit',
    category: 'a11y',
    description: 'Audit UI for accessibility issues.',
    body: 'Audit accessibility for: {{component}}\n\n1. Check ARIA labels and roles.\n2. Verify keyboard navigation.\n3. Test with screen reader.\n4. Check color contrast.\n5. Verify focus management.',
  },
];

function dir() { return path.join(DATA_DIR, 'templates'); }

function list() {
  const out = BUILTIN.map((t) => Object.assign({ builtin: true }, t));
  try {
    for (const f of fs.readdirSync(dir())) {
      if (!f.endsWith('.json')) continue;
      try {
        const t = JSON.parse(fs.readFileSync(path.join(dir(), f), 'utf8'));
        if (t && t.id) out.push(Object.assign({ builtin: false }, t));
      } catch (e) {}
    }
  } catch (e) {}
  return out;
}

function get(id) {
  const found = list().find((t) => t.id === id);
  return found || null;
}

function save(tpl) {
  const id = String((tpl && (tpl.id || tpl.name)) || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!id) throw Object.assign(new Error('template id required'), { status: 400 });
  const record = { id, name: tpl.name || id, category: tpl.category || 'custom', description: tpl.description || '', body: tpl.body || '' };
  fs.mkdirSync(dir(), { recursive: true });
  fs.writeFileSync(path.join(dir(), id + '.json'), JSON.stringify(record, null, 2));
  return record;
}

function remove(id) {
  try { fs.unlinkSync(path.join(dir(), id + '.json')); return { ok: true, id }; }
  catch (e) { return { ok: false, id, error: String(e.message || e) }; }
}

function render(id, vars) {
  const t = get(id);
  if (!t) return null;
  const body = String(t.body || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (vars && vars[k] != null ? vars[k] : m));
  return Object.assign({}, t, { rendered: body });
}

module.exports = { BUILTIN, list, get, save, remove, render };
