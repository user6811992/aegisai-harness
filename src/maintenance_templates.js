// src/maintenance_templates.js
// Scheduled maintenance agent templates (changelog, docs fix, quickstart check).
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./core/config');

const TEMPLATES = {
  changelog: {
    name: 'changelog',
    prompt: 'Review recent commits and keep the CHANGELOG current. Open a reviewable pull request with the changes.',
    cron: '0 9 * * MON',
  },
  docs_fix: {
    name: 'docs_fix',
    prompt: 'Run the SDK quickstart against the current docs. If a step fails, propose a verified documentation fix.',
    cron: '0 8 * * *',
  },
  quickstart_check: {
    name: 'quickstart_check',
    prompt: 'Run the quickstart end to end, report any failures and propose fixes.',
    cron: '0 6 * * *',
  },
  test_coverage: {
    name: 'test_coverage',
    prompt: 'Find risky missing test coverage and open a focused test-only pull request.',
    cron: '0 10 * * FRI',
  },
};

function dir() { return path.join(DATA_DIR, 'maintenance-templates'); }
function list() { return Object.values(TEMPLATES); }
function install(name) {
  const t = TEMPLATES[name];
  if (!t) return null;
  fs.mkdirSync(dir(), { recursive: true });
  fs.writeFileSync(path.join(dir(), name + '.json'), JSON.stringify(t, null, 2));
  return t;
}

module.exports = { TEMPLATES, list, install };
