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
function inlineFormat(text) {
  let s = text;
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => '<a href="' + escapeHtml(safeUrl(url.replace(/&amp;/g, '&'))) + '" target="_blank" rel="noopener">' + label + '</a>');
  return s;
}
function render(text) {
  let s = escapeHtml(text);
  // thinking blocks
  s = s.replace(/&lt;think&gt;([\s\S]*?)&lt;\/think&gt;/g, (_, t) => '<details class="think"><summary>Thinking</summary>' + t + '</details>');
  // fenced code
  s = s.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => '<pre class="code"><code data-lang="' + lang + '">' + highlight(code.replace(/\n$/, '')) + '</code></pre>');
  // headings
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // tables (parse on raw text before inline formatting of pipes)
  s = s.replace(/(?:^|\n)(\|.+\|\n\|[-:| ]+\|\n(?:\|.+\|\n?)+)/g, (block) => {
    const lines = block.trim().split('\n');
    if (lines.length < 3) return block;
    function splitCells(line) {
      const cells = [];
      let current = '';
      let inCode = false;
      let inLink = 0; // depth of parentheses in link destinations
      let escaped = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (escaped) { current += ch; escaped = false; continue; }
        if (ch === '\\') { escaped = true; current += ch; continue; }
        if (ch === '`') { inCode = !inCode; current += ch; }
        else if (ch === '(' && !inCode) { inLink++; current += ch; }
        else if (ch === ')' && !inCode && inLink > 0) { inLink--; current += ch; }
        else if (ch === '|' && !inCode && inLink === 0) { cells.push(current.trim()); current = ''; }
        else { current += ch; }
      }
      if (current.trim() || cells.length > 0) cells.push(current.trim());
      if (cells.length > 0 && cells[0] === '') cells.shift();
      if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
      return cells;
    }
    const header = splitCells(lines[0]).map(inlineFormat);
    const rows = lines.slice(2).map((l) => splitCells(l).map(inlineFormat));
    let html = '<table class="md-table"><thead><tr>' + header.map((h) => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>';
    for (const row of rows) html += '<tr>' + row.map((c) => '<td>' + c + '</td>').join('') + '</tr>';
    html += '</tbody></table>';
    return '\n' + html + '\n';
  });
  // inline code
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold/italic
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => '<a href="' + escapeHtml(safeUrl(url.replace(/&amp;/g, '&'))) + '" target="_blank" rel="noopener">' + label + '</a>');
  // lists
  s = s.replace(/^- (.+)$/gm, '<li>$1</li>');
  // paragraphs
  s = s.split(/\n{2,}/).map((b) => /^<(h\d|pre|ul|li|details|table)/.test(b.trim()) ? b : '<p>' + b.replace(/\n/g, '<br>') + '</p>').join('\n');
  return s;
}
window.HarnessMarkdown = { render, escapeHtml, safeUrl };