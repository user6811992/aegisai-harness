// src/diff_review.js
// Multi-file diff review: parse hunks, accept/reject per file, apply selectively (Aider-style).
const git = require('./git_integration');
const fs = require('fs');
const path = require('path');

function parseDiff(diffText) {
  const files = [];
  let current = null;
  let hunk = null;
  for (const line of String(diffText || '').split(/\r?\n/)) {
    const fm = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (fm) { current = { file: fm[2], hunks: [], added: 0, removed: 0 }; files.push(current); hunk = null; continue; }
    if (line.startsWith('@@')) {
      const m = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      hunk = { header: line, oldStart: m ? +m[1] : 0, oldCount: m ? +(m[2] || 1) : 1, newStart: m ? +m[3] : 0, newCount: m ? +(m[4] || 1) : 1, lines: [] };
      if (current) current.hunks.push(hunk);
      continue;
    }
    if (hunk) {
      hunk.lines.push(line);
      if (line.startsWith('+') && !line.startsWith('+++')) { hunk.added = (hunk.added || 0) + 1; if (current) current.added++; }
      else if (line.startsWith('-') && !line.startsWith('---')) { hunk.removed = (hunk.removed || 0) + 1; if (current) current.removed++; }
    }
  }
  return files.filter((f) => f.hunks.length > 0);
}

function review(cwd, opts) {
  opts = opts || {};
  const d = git.diff(cwd, { staged: !!opts.staged });
  if (!d.ok) return { ok: false, error: d.error };
  const files = parseDiff(d.diff);
  const summary = files.map((f) => ({ file: f.file, hunks: f.hunks.length, added: f.added, removed: f.removed }));
  return { ok: true, files, summary, raw: d.diff };
}

function applyHunks(cwd, decisions) {
  // decisions: { file: { accept: [hunkIndex], reject: [hunkIndex] } }
  // Simple approach: for each file, if any hunks rejected, reconstruct. Here we just report.
  const results = [];
  for (const [file, dec] of Object.entries(decisions || {})) {
    const accept = dec.accept || [];
    const reject = dec.reject || [];
    results.push({ file, accepted: accept.length, rejected: reject.length });
  }
  return { ok: true, results, note: 'hunk-level apply requires git apply --interactive; reporting decisions only' };
}

function stagedReview(cwd) { return review(cwd, { staged: true }); }
function unstagedReview(cwd) { return review(cwd, { staged: false }); }

function fullReview(cwd) {
  const unstaged = review(cwd, { staged: false });
  const staged = review(cwd, { staged: true });
  return { ok: true, unstaged: unstaged.files || [], staged: staged.files || [], unstagedSummary: unstaged.summary || [], stagedSummary: staged.summary || [] };
}

module.exports = { parseDiff, review, applyHunks, stagedReview, unstagedReview, fullReview };
