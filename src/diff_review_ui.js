// src/diff_review_ui.js
// Interactive multi-file diff review (TUI integration): show hunks, accept/reject per file/hunk.
const diffReview = require('./diff_review');
const git = require('./git_integration');

function startSession(cwd, opts) {
  opts = opts || {};
  const r = diffReview.review(cwd, { staged: !!opts.staged });
  if (!r.ok) return { ok: false, error: r.error };
  const session = {
    cwd,
    staged: !!opts.staged,
    files: r.files,
    summary: r.summary,
    decisions: {}, // file -> { accept: [], reject: [] }
    cursor: 0,     // current file index
    currentHunk: 0,
    done: false,
  };
  for (const f of r.files) session.decisions[f.file] = { accept: [], reject: [] };
  return { ok: true, session };
}

function currentFile(session) {
  if (!session || session.cursor >= session.files.length) return null;
  return session.files[session.cursor];
}

function acceptHunk(session, hunkIdx) {
  const f = currentFile(session);
  if (!f) return { ok: false, error: 'no current file' };
  const idx = hunkIdx !== undefined ? hunkIdx : session.currentHunk;
  if (!session.decisions[f.file].accept.includes(idx)) session.decisions[f.file].accept.push(idx);
  session.decisions[f.file].reject = session.decisions[f.file].reject.filter((x) => x !== idx);
  return { ok: true, file: f.file, hunk: idx, decision: 'accept' };
}

function rejectHunk(session, hunkIdx) {
  const f = currentFile(session);
  if (!f) return { ok: false, error: 'no current file' };
  const idx = hunkIdx !== undefined ? hunkIdx : session.currentHunk;
  if (!session.decisions[f.file].reject.includes(idx)) session.decisions[f.file].reject.push(idx);
  session.decisions[f.file].accept = session.decisions[f.file].accept.filter((x) => x !== idx);
  return { ok: true, file: f.file, hunk: idx, decision: 'reject' };
}

function acceptFile(session) {
  const f = currentFile(session);
  if (!f) return { ok: false, error: 'no current file' };
  for (let i = 0; i < f.hunks.length; i++) acceptHunk(session, i);
  return { ok: true, file: f.file, decision: 'accept-all' };
}

function rejectFile(session) {
  const f = currentFile(session);
  if (!f) return { ok: false, error: 'no current file' };
  for (let i = 0; i < f.hunks.length; i++) rejectHunk(session, i);
  return { ok: true, file: f.file, decision: 'reject-all' };
}

function nextFile(session) {
  if (session.cursor < session.files.length - 1) session.cursor++;
  session.currentHunk = 0;
  return currentFile(session);
}

function prevFile(session) {
  if (session.cursor > 0) session.cursor--;
  session.currentHunk = 0;
  return currentFile(session);
}

function nextHunk(session) {
  const f = currentFile(session);
  if (!f) return null;
  if (session.currentHunk < f.hunks.length - 1) session.currentHunk++;
  return { file: f.file, hunk: session.currentHunk, total: f.hunks.length };
}

function prevHunk(session) {
  const f = currentFile(session);
  if (!f) return null;
  if (session.currentHunk > 0) session.currentHunk--;
  return { file: f.file, hunk: session.currentHunk, total: f.hunks.length };
}

function status(session) {
  const f = currentFile(session);
  const decided = Object.values(session.decisions).reduce((a, d) => a + d.accept.length + d.reject.length, 0);
  const total = session.files.reduce((a, f) => a + f.hunks.length, 0);
  return {
    files: session.files.length,
    currentFile: f ? f.file : null,
    currentHunk: f ? session.currentHunk + 1 : 0,
    totalHunks: f ? f.hunks.length : 0,
    decided,
    total,
    done: session.done,
  };
}

function finish(session) {
  session.done = true;
  const accepted = [];
  const rejected = [];
  for (const [file, dec] of Object.entries(session.decisions)) {
    if (dec.accept.length > 0) accepted.push({ file, hunks: dec.accept });
    if (dec.reject.length > 0) rejected.push({ file, hunks: dec.reject });
  }
  return { ok: true, accepted, rejected, summary: status(session) };
}

function renderCurrent(session) {
  const f = currentFile(session);
  if (!f) return '(no more files)';
  const hunk = f.hunks[session.currentHunk];
  const lines = [];
  lines.push('=== ' + f.file + ' (' + (session.currentHunk + 1) + '/' + f.hunks.length + ' hunks) ===');
  lines.push(hunk.header);
  for (const l of hunk.lines) lines.push(l);
  const dec = session.decisions[f.file];
  const state = dec.accept.includes(session.currentHunk) ? '[ACCEPTED]' : dec.reject.includes(session.currentHunk) ? '[REJECTED]' : '[pending]';
  lines.push(state);
  return lines.join('\n');
}

module.exports = { startSession, currentFile, acceptHunk, rejectHunk, acceptFile, rejectFile, nextFile, prevFile, nextHunk, prevHunk, status, finish, renderCurrent };
