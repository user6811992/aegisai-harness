// src/channels_extra.js
// Microsoft Teams and Mattermost channel adapters.
// Same contract as src/channels.js: handle(text, opts) -> { ok, reply, channel }.
// No network calls unless a webhook/client is configured.

function teamsPayload(text, opts) {
  opts = opts || {};
  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor: opts.color || '0A66C2',
    summary: opts.title || 'AegisAi Harness',
    sections: [{ activityTitle: opts.title || 'AegisAi Harness', text: String(text || '') }],
  };
}

function mattermostPayload(text, opts) {
  opts = opts || {};
  return { channel: opts.channel || '', username: opts.username || 'aegisai-harness', text: String(text || '') };
}

function handleTeams(input, client) {
  return handle('teams', input, client, teamsPayload);
}
function handleMattermost(input, client) {
  return handle('mattermost', input, client, mattermostPayload);
}

function handle(kind, input, client, payloadFor) {
  const text = typeof input === 'string' ? input : (input && input.text) || '';
  const mention = /@?aegis(ai)?(?:-harness)?\b/i.exec(text);
  const body = mention ? text.slice(mention.index + mention[0].length).trim() : text.trim();
  const payload = payloadFor(body || text, input && input.opts);
  if (!client || typeof client.send !== 'function') {
    return { ok: false, channel: kind, note: 'no ' + kind + ' client configured (mock mode)', payload };
  }
  try {
    const r = client.send(payload);
    return { ok: true, channel: kind, sent: true, result: r };
  } catch (e) {
    return { ok: false, channel: kind, error: String(e.message || e) };
  }
}

function status() {
  return {
    teams: { configured: Boolean(process.env.AEGISAI_TEAMS_WEBHOOK), transport: 'incoming-webhook' },
    mattermost: { configured: Boolean(process.env.AEGISAI_MATTERMOST_URL), transport: 'incoming-webhook' },
    existing: ['slack', 'telegram', 'discord', 'dingtalk', 'feishu'],
  };
}

// Post to a configured incoming webhook (opt-in, network call).
async function post(kind, text, opts) {
  opts = opts || {};
  const url = kind === 'teams' ? process.env.AEGISAI_TEAMS_WEBHOOK : process.env.AEGISAI_MATTERMOST_URL;
  if (!url) return { ok: false, channel: kind, error: 'webhook not configured' };
  const payload = kind === 'teams' ? teamsPayload(text, opts) : mattermostPayload(text, opts);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
    return { ok: r.ok, channel: kind, status: r.status };
  } catch (e) {
    return { ok: false, channel: kind, error: String(e.message || e) };
  }
}

module.exports = { teamsPayload, mattermostPayload, handleTeams, handleMattermost, status, post };
