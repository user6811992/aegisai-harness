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
// Math rendering (KaTeX)
function renderMath(text, display) {
  if (window.katex) {
    try { return window.katex.renderToString(text, { displayMode: !!display, throwOnError: false }); }
    catch (e) { return escapeHtml(text); }
  }
  return escapeHtml(text);
}
// Mermaid rendering
function renderMermaid(code) {
  if (window.mermaid) {
    try {
      const id = 'mermaid-' + Math.random().toString(36).slice(2, 8);
      window.mermaid.render(id, code).then((r) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = r.svg;
      });
      return '<div class="mermaid" id="' + id + '">' + escapeHtml(code) + '</div>';
    } catch (e) { return '<pre class="code"><code>' + escapeHtml(code) + '</code></pre>'; }
  }
  return '<pre class="code"><code>' + escapeHtml(code) + '</code></pre>';
}
  let s = text;
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return s;
}
function render(text) {
  let s = escapeHtml(text);
  // Protect fenced code blocks with placeholders.
  const codeBlocks = [];
  s = s.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    if (lang === 'mermaid') {
      const idx = codeBlocks.length;
      codeBlocks.push(renderMermaid(code.trim()));
      return '\n@@CODEBLOCK_' + idx + '@@\n';
    }
    const idx = codeBlocks.length;
    codeBlocks.push('<pre class="code"><code data-lang="' + lang + '">' + highlight(code.replace(/\n$/, '')) + '</code></pre>');
    return '\n@@CODEBLOCK_' + idx + '@@\n';
  });
  // Protect inline code spans.
  const inlineCodes = [];
  s = s.replace(/`([^`]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push('<code>' + escapeHtml(code) + '</code>');
    return '@@INLINE_' + idx + '@@';
  });
  // Display math ($$...$$)
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => renderMath(math.trim(), true));
  // Inline math ($...$)
  s = s.replace(/\$([^$\n]+)\$/g, (_, math) => renderMath(math.trim(), false));
  // thinking blocks
  s = s.replace(/&lt;think&gt;([\s\S]*?)&lt;\/think&gt;/g, (_, t) => '<details class="think"><summary>Thinking</summary>' + t + '</details>');
  // headings
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // tables (parse on protected text)
  s = s.replace(/(?:^|\n)(\|.+\|\n\|[-:| ]+\|\n(?:\|.+\|\n?)+)/g, (block) => {
    const lines = block.trim().split('\n');
    if (lines.length < 3) return block;
    function splitCells(line) {
      const cells = [];
      let current = '';
      let inCode = false;
      let inLink = 0;
      let escaped = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (escaped) {
          if (ch === '|') { current += '|'; }
          else { current += '\\' + ch; }
          escaped = false;
          continue;
        }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '`') { inCode = !inCode; current += ch; }
        else if (ch === '(' && !inCode && i > 0 && line[i - 1] === ']') { inLink++; current += ch; }
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
  // Restore inline code.
  s = s.replace(/@@INLINE_(\d+)@@/g, (_, idx) => inlineCodes[Number(idx)]);
  // inline code (for any remaining)
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // bold/italic
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => '<a href="' + escapeHtml(safeUrl(url.replace(/&amp;/g, '&'))) + '" target="_blank" rel="noopener">' + label + '</a>');
  // lists
  s = s.replace(/^- (.+)$/gm, '<li>$1</li>');
  // paragraphs
  s = s.split(/\n{2,}/).map((b) => /^<(h\d|pre|ul|li|details|table)/.test(b.trim()) ? b : '<p>' + b.replace(/\n/g, '<br>') + '</p>').join('\n');
  // Restore code blocks.
  s = s.replace(/@@CODEBLOCK_(\d+)@@/g, (_, idx) => codeBlocks[Number(idx)]);
  return s;
}
window.HarnessMarkdown = { render, escapeHtml, safeUrl };