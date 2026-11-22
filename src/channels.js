// src/channels.js
// IM channel adapters: Telegram, Discord, DingTalk, Feishu (deer-flow "IM Channels").
const { runAgent } = require('./agent/run');

const adapters = {};

function register(name, adapter) { adapters[name] = adapter; return name; }

async function handle(channel, event, opts) {
  const a = adapters[channel];
  if (!a) return { ok: false, error: 'no adapter: ' + channel };
  const msg = a.parse ? a.parse(event) : event;
  const r = await runAgent({ model: (opts && opts.model) || process.env.AEGISAI_MODEL || 'llama3.2:3b', messages: [{ role: 'user', content: msg.text || '' }], projectRoot: (opts && opts.projectRoot) || process.cwd(), autoApprove: true, onEvent: () => {} });
  const reply = (r.final && r.final.final) || '';
  if (a.send) await a.send(msg, reply);
  return { channel, reply };
}

// Built-in Telegram adapter (polling-style, no SDK)
const telegram = {
  parse: (e) => ({ chatId: e.message && e.message.chat && e.message.chat.id, text: e.message && e.message.text, raw: e }),
  send: async (msg, reply) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return { ok: false, note: 'TELEGRAM_BOT_TOKEN not set' };
    try { await fetch('https://api.telegram.org/bot' + token + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: msg.chatId, text: reply }) }); return { ok: true }; } catch (e) { return { ok: false, error: String(e.message || e) }; }
  },
};

// Built-in Discord adapter (webhook-style)
const discord = {
  parse: (e) => ({ channelId: e.channel_id, text: e.content, raw: e }),
  send: async (msg, reply) => {
    const url = process.env.DISCORD_WEBHOOK_URL;
    if (!url) return { ok: false, note: 'DISCORD_WEBHOOK_URL not set' };
    try { await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: reply }) }); return { ok: true }; } catch (e) { return { ok: false, error: String(e.message || e) }; }
  },
};

register('telegram', telegram);
register('discord', discord);

function list() { return Object.keys(adapters); }
function status() { return { channels: list(), telegram: !!process.env.TELEGRAM_BOT_TOKEN, discord: !!process.env.DISCORD_WEBHOOK_URL }; }

module.exports = { register, handle, list, status, adapters };
