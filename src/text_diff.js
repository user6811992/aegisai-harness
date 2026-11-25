// src/text_diff.js
// Word-level diff (LCS) for comparing model responses side by side.
function tokenize(s) {
  return String(s == null ? '' : s).split(/(\s+)/).filter((t) => t !== '');
}
function diffWords(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  const n = A.length;
  const m = B.length;
  // LCS table (bounded to keep memory sane for very long replies).
  const cap = 4000;
  const an = Math.min(n, cap);
  const bm = Math.min(m, cap);
  const dp = Array.from({ length: an + 1 }, () => new Uint32Array(bm + 1));
  for (let i = an - 1; i >= 0; i--) {
    for (let j = bm - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out = [];
  let i = 0; let j = 0;
  while (i < an && j < bm) {
    if (A[i] === B[j]) { out.push({ type: 'same', text: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ type: 'del', text: A[i] }); i++; }
    else { out.push({ type: 'add', text: B[j] }); j++; }
  }
  while (i < an) { out.push({ type: 'del', text: A[i++] }); }
  while (j < bm) { out.push({ type: 'add', text: B[j++] }); }
  if (n > an) out.push({ type: 'del', text: ' …' + (n - an) + ' more words' });
  if (m > bm) out.push({ type: 'add', text: ' …' + (m - bm) + ' more words' });
  return out;
}
// Similarity ratio 0..1 (1 = identical).
function similarity(a, b) {
  const A = tokenize(a);
  const B = tokenize(b);
  if (!A.length && !B.length) return 1;
  const setB = new Map();
  for (const t of B) setB.set(t, (setB.get(t) || 0) + 1);
  let common = 0;
  for (const t of A) {
    const c = setB.get(t) || 0;
    if (c > 0) { common++; setB.set(t, c - 1); }
  }
  return (2 * common) / (A.length + B.length);
}
module.exports = { diffWords, similarity, tokenize };
