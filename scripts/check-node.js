// scripts/check-node.js — fail fast with a useful message on unsupported Node.
// Runs as `preinstall` so `npm i -g aegisai-harness` does not leave a broken CLI.
const MIN_MAJOR = 22;
const MIN_MINOR = 13; // node:sqlite is unflagged from 22.13 onward

const parts = process.versions.node.split('.').map(Number);
const major = parts[0] || 0;
const minor = parts[1] || 0;
const ok = major > MIN_MAJOR || (major === MIN_MAJOR && minor >= MIN_MINOR);

if (!ok) {
  console.error(
    `[aegisai-harness] Node.js ${MIN_MAJOR}.${MIN_MINOR}+ is required (found ${process.versions.node}).\n` +
    'Install the current LTS from https://nodejs.org, reopen your terminal, then retry.\n' +
    'On Windows, verify with: node -v'
  );
  process.exit(1);
}

if (require.main === module) {
  console.log(`[aegisai-harness] Node ${process.versions.node} OK`);
}
module.exports = { ok, minimum: `${MIN_MAJOR}.${MIN_MINOR}` };
