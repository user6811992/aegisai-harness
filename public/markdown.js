// Safe client-side Markdown renderer (escape-first, no raw HTML injection).
function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function safeUrl(u) {
  try { const p = new URL(u, location.href); return ['http:', 'https:', 'mailto:'].includes(p.protocol) ? p.href : '#'; } catch (e) { return '#'; }
}
function highlight(code) {
  const kw = /\b(function|const|let|var|return|if|else|for|while|class|def|import|from|async|await|new|try|catch|throw|public|private|static|void|int|string)\b/g;
  const str = /(['"`])(?:(?!\1)[^\\]|\\.)*\1/g;
  return escapeHtml(code)
    .replace(str, (m) => '<span class="str">' + m + '</span>')
    .replace(kw, (m) => '<span class="kw">' + m + '</span>');
}
function render(text) {
  let s = escapeHtml(text);
  // thinking blocks
  s = s.replace(/&lt;think&gt;([\s\S]*?)&lt;\/think&gt;/g, (_, t) => '<details class="think"><summary>Thinking</summary>' + t + '</details>');
  // fenced code
  s = s.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => '<pre class="code"><code data-lang="' + lang + '">' + highlight(code.replace(/\n$/, '')) + '</code></pre>');
  // headings
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // inline code
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold/italic
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // links (url already escaped; safeUrl handles protocols)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => '<a href="' + escapeHtml(safeUrl(url.replace(/&amp;/g, '&'))) + '" target="_blank" rel="noopener">' + label + '</a>');
  // lists
  s = s.replace(/^- (.+)$/gm, '<li>$1</li>');
  // paragraphs
  s = s.split(/\n{2,}/).map((b) => /^<(h\d|pre|ul|li|details)/.test(b.trim()) ? b : '<p>' + b.replace(/\n/g, '<br>') + '</p>').join('\n');
  return s;
}
window.HarnessMarkdown = { render, escapeHtml, safeUrl };
