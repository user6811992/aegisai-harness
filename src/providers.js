// src/providers.js
// Model provider registry: catalog of known providers with auto-detection.
const { detectBackend, getType, getUrl, setBackend } = require('./backends');

const PROVIDERS = [
  { id: 'ollama', name: 'Ollama', type: 'ollama', defaultUrl: 'http://127.0.0.1:11434', probe: '/api/version', local: true, note: 'Local LLM runtime (recommended)' },
  { id: 'lmstudio', name: 'LM Studio', type: 'lmstudio', defaultUrl: 'http://127.0.0.1:1234', probe: '/v1/models', local: true, note: 'Local OpenAI-compat server' },
  { id: 'llamacpp', name: 'llama.cpp server', type: 'llamacpp', defaultUrl: 'http://127.0.0.1:8080', probe: '/v1/models', local: true, note: 'llama-server HTTP' },
  { id: 'vllm', name: 'vLLM', type: 'openai', defaultUrl: 'http://127.0.0.1:8000', probe: '/v1/models', local: true, note: 'High-throughput serving' },
  { id: 'textgen', name: 'text-generation-webui', type: 'openai', defaultUrl: 'http://127.0.0.1:5000', probe: '/v1/models', local: true, note: 'Oobabooga webui' },
  { id: 'koboldcpp', name: 'KoboldCpp', type: 'openai', defaultUrl: 'http://127.0.0.1:5001', probe: '/v1/models', local: true, note: 'KoboldCpp server' },
  { id: 'localai', name: 'LocalAI', type: 'openai', defaultUrl: 'http://127.0.0.1:8080', probe: '/v1/models', local: true, note: 'LocalAI (OpenAI drop-in)' },
  { id: 'jan', name: 'Jan', type: 'openai', defaultUrl: 'http://127.0.0.1:1337', probe: '/v1/models', local: true, note: 'Jan local AI' },
  { id: 'openai', name: 'OpenAI', type: 'openai', defaultUrl: 'https://api.openai.com', probe: '/v1/models', local: false, note: 'GPT-4o, o1, etc.' },
  { id: 'anthropic', name: 'Anthropic', type: 'anthropic', defaultUrl: 'https://api.anthropic.com', probe: '/v1/models', local: false, note: 'Claude' },
  { id: 'groq', name: 'Groq', type: 'openai', defaultUrl: 'https://api.groq.com/openai', probe: '/v1/models', local: false, note: 'Fast inference' },
  { id: 'mistral', name: 'Mistral', type: 'openai', defaultUrl: 'https://api.mistral.ai', probe: '/v1/models', local: false, note: 'Mistral models' },
  { id: 'deepseek', name: 'DeepSeek', type: 'openai', defaultUrl: 'https://api.deepseek.com', probe: '/v1/models', local: false, note: 'DeepSeek V3/R1' },
  { id: 'together', name: 'Together AI', type: 'openai', defaultUrl: 'https://api.together.xyz', probe: '/v1/models', local: false, note: 'Open models' },
  { id: 'fireworks', name: 'Fireworks AI', type: 'openai', defaultUrl: 'https://api.fireworks.ai/inference', probe: '/v1/models', local: false, note: 'Fast open models' },
  { id: 'cohere', name: 'Cohere', type: 'openai', defaultUrl: 'https://api.cohere.com/compatibility', probe: '/v1/models', local: false, note: 'Command models' },
  { id: 'openrouter', name: 'OpenRouter', type: 'openai', defaultUrl: 'https://openrouter.ai/api', probe: '/v1/models', local: false, note: 'Multi-provider router' },
  { id: 'gemini', name: 'Google Gemini', type: 'openai', defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', probe: '/v1/models', local: false, note: 'Gemini models' },
];

async function probe(provider) {
  try {
    const r = await fetch(provider.defaultUrl + provider.probe, { signal: AbortSignal.timeout(3000), headers: provider.local ? {} : { 'Authorization': 'Bearer ' + (process.env[provider.id.toUpperCase() + '_API_KEY'] || process.env.BACKEND_API_KEY || '') } });
    return r.ok;
  } catch (e) { return false; }
}

async function detect() {
  const results = [];
  for (const p of PROVIDERS) {
    if (!p.local) { results.push({ ...p, running: false, note: 'cloud (set API key)' }); continue; }
    const running = await probe(p);
    results.push({ ...p, running });
  }
  return results;
}

function get(id) { return PROVIDERS.find((p) => p.id === id) || null; }
function list() { return PROVIDERS; }
function local() { return PROVIDERS.filter((p) => p.local); }
function cloud() { return PROVIDERS.filter((p) => !p.local); }

async function autoSelect() {
  const detected = await detect();
  const running = detected.filter((p) => p.running);
  if (running.length === 0) return { ok: false, error: 'no local provider detected' };
  const pick = running[0];
  setBackend(pick.type, pick.defaultUrl);
  return { ok: true, provider: pick.id, type: pick.type, url: pick.defaultUrl };
}

module.exports = { PROVIDERS, probe, detect, get, list, local, cloud, autoSelect };
