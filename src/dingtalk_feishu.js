// src/dingtalk_feishu.js
// DingTalk + Feishu channel adapters (deer-flow "IM Channels").
const { runAgent } = require('./agent/run');

const dingtalk = {
  parse: (e) => ({ conversationId: e.conversationId || e.chatId, text: e.text || (e.content && e.content.content) || '' }),
  send: async (msg, reply) => {
    const url = process.env.DINGTALK_WEBHOOK_URL;
    if (!url) return { ok: false, note: 'DINGTALK_WEBHOOK_URL not set' };
    try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msgtype: 'text', text: { content: reply } }) }); return { ok: true }; } catch (e) { return { ok: false, error: String(e.message || e) }; }
  },
};
const feishu = {
  parse: (e) => ({ chatId: e.chat_id || e.open_chat_id, text: e.text || (e.message && e.message.content) || '' }),
  send: async (msg, reply) => {
    const url = process.env.FEISHU_WEBHOOK_URL;
    if (!url) return { ok: false, note: 'FEISHU_WEBHOOK_URL not set' };
    try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ msg_type: 'text', content: { text: reply } }) }); return { ok: true }; } catch (e) { return { ok: false, error: String(e.message || e) }; }
  },
};

const channels = require('./channels');
channels.register('dingtalk', dingtalk);
channels.register('feishu', feishu);

module.exports = { dingtalk, feishu };
