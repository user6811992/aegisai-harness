// src/backends/index.js
// Multi-backend adapter (Ollama + OpenAI-compatible). Normalizes to Ollama shape.
const state = {
  type: (process.env.BACKEND_TYPE || '').toLowerCase(),
  url: process.env.BACKEND_URL || process.env.OLLAMA_URL || 'http://127.0.0.1:11434',
  apiKey: process.env.BACKEND_API_KEY || '',
  explicit: !!(process.env.BACKEND_TYPE || process.env.BACKEND_URL || process.env.OLLAMA_URL),
  routerUrls: [],
  routerStrategy: process.env.BACKEND_ROUTER_STRATEGY || 'round-robin',
  routerIndex: 0,
};

function pickRouterUrl() {
  if (!state.routerUrls.length) return state.url;
  let u;
  if (state.routerStrategy === 'random') {
    u = state.routerUrls[Math.floor(Math.random() * state.routerUrls.length)];
  } else {
    u = state.routerUrls[state.routerIndex % state.routerUrls.length];
    state.routerIndex += 1;
  }
  state._routerCompat = !/11434/.test(u);
  return u;
}

function isOpenaiCompat() {
  if (state.type === 'router') return !!state._routerCompat;
  const t = state.type;
  return ['llamacpp','lmstudio','openai','strata','robin','hyperqwen','exllamav3'].includes(t);
}

// circuit breaker
const cb = { failures: 0, openUntil: 0, threshold: 5, cooldownMs: 30000 };
function isCircuitOpen() { return Date.now() < cb.openUntil; }
function recordSuccess() { cb.failures = 0; cb.openUntil = 0; }
function recordFailure() {
  cb.failures += 1;
  if (cb.failures >= cb.threshold) cb.openUntil = Date.now() + cb.cooldownMs;
}

function mergeToolCalls(existing, incoming) {
  if (!incoming) return existing;
  const parts = Array.isArray(incoming) ? incoming : [incoming];
  const out = Array.isArray(existing) ? existing.map((x) => Object.assign({}, x)) : [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] || {};
    const idx = (typeof part.index === 'number') ? part.index : i;
    if (!out[idx]) out[idx] = {};
    const target = out[idx];
    if (part.id) target.id = part.id;
    if (part.type) target.type = part.type;
    const pf = part.function || part;
    if (!target.function) target.function = {};
    if (pf.name) target.function.name = pf.name;
    if (pf.arguments !== undefined) {
      if (typeof pf.arguments === 'string') {
        target.function.arguments = (target.function.arguments || '') + pf.arguments;
      } else {
        target.function.arguments = pf.arguments;
      }
    }
  }
  return out.filter(Boolean);
}

function getType() { return state.type; }
function getUrl() { return state.url; }
function getApiKey() { return state.apiKey; }
function isOpenaiCompat() {
  if (state.type === 'router') return !!state._routerCompat;
  const t = state.type;
  return ['llamacpp','lmstudio','openai','strata','robin','hyperqwen','exllamav3'].includes(t);
}
function setBackend(type, url) {
  if (type) state.type = type.toLowerCase();
  if (url) state.url = url;
  state.explicit = true;
}

async function detectBackend() {
  if (state.type === 'router') {
    state.routerUrls = (state.url || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (state.routerUrls.length === 0) state.routerUrls = ['http://127.0.0.1:11434'];
    state.explicit = true;
    return;
  }
  if (state.explicit) {
    if (!state.type) state.type = 'ollama';
    if (!state.url) state.url = 'http://127.0.0.1:11434';
    return;
  }
  const probes = [
    { type: 'ollama', url: 'http://127.0.0.1:11434', path: '/api/version' },
    { type: 'lmstudio', url: 'http://127.0.0.1:1234', path: '/v1/models' },
    { type: 'llamacpp', url: 'http://127.0.0.1:8081', path: '/v1/models' },
    { type: 'openai', url: 'http://127.0.0.1:8000', path: '/v1/models' },
  ];
  for (const p of probes) {
    try {
      const r = await fetch(p.url + p.path, { signal: AbortSignal.timeout(2000) });
      if (r.ok) { state.type = p.type; state.url = p.url; return; }
    } catch (e) {}
  }
  if (!state.type) { state.type = 'ollama'; state.url = state.url || 'http://127.0.0.1:11434'; }
}

async function backendChatImpl(bodyObj, onChunk, signal) {
  if (state.type === 'router') state.url = pickRouterUrl();
  if (!isOpenaiCompat()) {
    const ollamaBody = Object.assign({}, bodyObj);
    if (bodyObj.maxTokens && bodyObj.maxTokens > 0) {
      ollamaBody.options = Object.assign({}, bodyObj.options || {}, { num_predict: bodyObj.maxTokens });
    }
    const r = await fetch(state.url + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaBody), signal,
    });
    if (!r.ok) throw new Error('Chat failed: ' + r.status);
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = '', fullContent = '', toolCalls = null, promptTokens = 0, completionTokens = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed);
          if (obj.message) {
            if (obj.message.content) { fullContent += obj.message.content; if (onChunk) onChunk({ type: 'token', content: obj.message.content }); }
            if (obj.message.thinking) { if (onChunk) onChunk({ type: 'thinking', content: obj.message.thinking }); }
            if (obj.message.tool_calls) { toolCalls = mergeToolCalls(toolCalls, obj.message.tool_calls); if (onChunk) onChunk({ type: 'tool_calls', tool_calls: obj.message.tool_calls }); }
          }
          if (obj.eval_count) completionTokens = obj.eval_count;
          if (obj.prompt_eval_count) promptTokens = obj.prompt_eval_count;
          if (obj.done && onChunk) onChunk({ type: 'done' });
        } catch (e) {}
      }
    }
    return { status: 200, data: { message: { role: 'assistant', content: fullContent, tool_calls: toolCalls }, done: true, eval_count: completionTokens, prompt_eval_count: promptTokens } };
  }

  // OpenAI-compat
  const oaiBody = {
    model: bodyObj.model,
    messages: bodyObj.messages || [],
    stream: bodyObj.stream !== false,
    temperature: bodyObj.options && bodyObj.options.temperature,
  };
  if (bodyObj.maxTokens && bodyObj.maxTokens > 0) oaiBody.max_tokens = bodyObj.maxTokens;
  const headers = { 'Content-Type': 'application/json' };
  if (state.apiKey) headers['Authorization'] = 'Bearer ' + state.apiKey;
  const r = await fetch(state.url + '/v1/chat/completions', { method: 'POST', headers, body: JSON.stringify(oaiBody), signal });
  if (!r.ok) throw new Error('Chat failed: ' + r.status + ' ' + (await r.text()));
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '', buf = '', promptTokens = 0, completionTokens = 0, toolCalls = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const obj = JSON.parse(payload);
        const delta = (obj.choices && obj.choices[0] && obj.choices[0].delta) || {};
        if (delta.content) { fullContent += delta.content; if (onChunk) onChunk({ type: 'token', content: delta.content }); }
        if (delta.tool_calls) { toolCalls = mergeToolCalls(toolCalls, delta.tool_calls); if (onChunk) onChunk({ type: 'tool_calls', tool_calls: delta.tool_calls }); }
        if (obj.usage) { promptTokens = obj.usage.prompt_tokens || promptTokens; completionTokens = obj.usage.completion_tokens || completionTokens; }
      } catch (_) {}
    }
  }
  if (onChunk) onChunk({ type: 'done' });
  return { status: 200, data: { message: { role: 'assistant', content: fullContent, tool_calls: toolCalls }, done: true, eval_count: completionTokens, prompt_eval_count: promptTokens } };
}

async function backendListModels() {
  if (!isOpenaiCompat()) {
    const r = await fetch(state.url + '/api/tags');
    if (!r.ok) throw new Error('Failed to list models: ' + r.status);
    return r.json();
  }
  const headers = { 'Content-Type': 'application/json' };
  if (state.apiKey) headers['Authorization'] = 'Bearer ' + state.apiKey;
  const r = await fetch(state.url + '/v1/models', { headers });
  if (!r.ok) throw new Error('Failed to list models: ' + r.status);
  const data = await r.json();
  const models = (data.data || []).map((m) => ({ name: m.id, model: m.id }));
  return { models };
}

async function backendChat(bodyObj, onChunk, signal) {
  if (isCircuitOpen()) throw new Error('circuit breaker open');
  const retries = 3;
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const r = await backendChatImpl(bodyObj, onChunk, signal);
      recordSuccess();
      return r;
    } catch (e) {
      lastErr = e;
      recordFailure();
      if (i < retries - 1) await new Promise((res) => setTimeout(res, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

async function healthCheck() {
  try {
    const r = await fetch(state.url + (isOpenaiCompat() ? '/v1/models' : '/api/version'), { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch (e) { return false; }
}

module.exports = { state, getType, getUrl, getApiKey, isOpenaiCompat, setBackend, detectBackend, backendChat, backendListModels, healthCheck, isCircuitOpen };
