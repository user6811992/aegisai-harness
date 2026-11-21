// src/formats.js
// Convert between OpenAI chat, Claude, and internal message formats.
function toChatMessage(m) {
  if (!m) return null;
  return { role: m.role || 'user', content: typeof m.content === 'string' ? m.content : (m.content || '') };
}
function toClaudeMessage(m) {
  if (!m) return null;
  const role = m.role === 'assistant' ? 'assistant' : 'user';
  return { role, content: [{ type: 'text', text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '') }] };
}
function fromChatMessages(arr) {
  return (arr || []).map((m) => ({ role: m.role || 'user', content: typeof m.content === 'string' ? m.content : (m.content && m.content[0] && m.content[0].text) || '' }));
}
function fromClaudeMessages(arr) {
  return (arr || []).map((m) => {
    const text = Array.isArray(m.content) ? m.content.map((c) => c.text || '').join('') : (m.content || '');
    return { role: m.role === 'assistant' ? 'assistant' : 'user', content: text };
  });
}
module.exports = { toChatMessage, toClaudeMessage, fromChatMessages, fromClaudeMessages };
