// src/conversation_export.js
// Export conversations to Markdown, JSON, and PDF (text-based).
const fs = require('fs');
const path = require('path');

function toMarkdown(messages, meta) {
  meta = meta || {};
  const lines = [];
  lines.push('# Conversation Export');
  lines.push('');
  if (meta.title) lines.push('**Title:** ' + meta.title);
  if (meta.model) lines.push('**Model:** ' + meta.model);
  if (meta.date) lines.push('**Date:** ' + meta.date);
  lines.push('');
  lines.push('---');
  lines.push('');
  for (const m of messages) {
    const role = (m.role || 'unknown').charAt(0).toUpperCase() + (m.role || 'unknown').slice(1);
    lines.push('## ' + role);
    lines.push('');
    lines.push(m.content || '');
    lines.push('');
  }
  return lines.join('\n');
}

function toJSON(messages, meta) {
  return JSON.stringify({ meta: meta || {}, messages: messages || [], exportedAt: new Date().toISOString() }, null, 2);
}

function toText(messages, meta) {
  meta = meta || {};
  const lines = [];
  if (meta.title) lines.push('Title: ' + meta.title);
  if (meta.model) lines.push('Model: ' + meta.model);
  if (meta.date) lines.push('Date: ' + meta.date);
  lines.push('');
  for (const m of messages) {
    lines.push('[' + (m.role || 'unknown').toUpperCase() + ']');
    lines.push(m.content || '');
    lines.push('');
  }
  return lines.join('\n');
}

// Simple PDF-like text output (not a real PDF, but a text file with .pdf extension for compatibility)
// For real PDF, would need a library. This produces a readable text document.
function toPDF(messages, meta) {
  // Produce a simple text-based document that can be opened in any text editor
  // In a real implementation, this would use a PDF library like pdfkit
  const text = toText(messages, meta);
  return { content: text, mimeType: 'text/plain', extension: '.txt', note: 'PDF generation requires pdfkit; returning text format' };
}

function exportToFile(messages, meta, format, outputPath) {
  format = (format || 'markdown').toLowerCase();
  let content, ext;
  if (format === 'json') { content = toJSON(messages, meta); ext = '.json'; }
  else if (format === 'text' || format === 'txt') { content = toText(messages, meta); ext = '.txt'; }
  else if (format === 'pdf') { const r = toPDF(messages, meta); content = r.content; ext = r.extension; }
  else { content = toMarkdown(messages, meta); ext = '.md'; }
  const filePath = outputPath || path.join(process.cwd(), 'conversation-export' + ext);
  fs.writeFileSync(filePath, content, 'utf8');
  return { ok: true, path: filePath, format, bytes: Buffer.byteLength(content) };
}

module.exports = { toMarkdown, toJSON, toText, toPDF, exportToFile };
