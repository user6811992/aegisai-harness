// src/core/config.js
// Central configuration for the harness. Reads env vars with sensible defaults.
const path = require('path');

const DATA_DIR = process.env.AEGISAI_DATA_DIR || path.join(process.cwd(), 'data');
const PORT = parseInt(process.env.PORT || process.env.AEGISAI_PORT || '8080', 10);
const HOST = process.env.HOST || process.env.AEGISAI_HOST || '127.0.0.1';
const TOKEN = process.env.LOCALAI_TOKEN || process.env.AEGISAI_TOKEN || '';
const RATE_LIMIT = parseInt(process.env.AEGISAI_RATE_LIMIT || '0', 10);
const RATE_WINDOW = parseInt(process.env.AEGISAI_RATE_WINDOW || '60', 10);
const TOOL_BUDGET = parseInt(process.env.AEGISAI_TOOL_BUDGET || '64', 10);
const MAX_BODY = parseInt(process.env.AEGISAI_MAX_BODY || String(100 * 1024 * 1024), 10);
const BACKEND_TYPE = process.env.BACKEND_TYPE || 'auto';
const BACKEND_URL = process.env.BACKEND_URL || process.env.OLLAMA_URL || '';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';
const OFFLINE = String(process.env.AEGISAI_OFFLINE || '').toLowerCase() === 'true';

module.exports = {
  DATA_DIR, PORT, HOST, TOKEN, RATE_LIMIT, RATE_WINDOW,
  TOOL_BUDGET, MAX_BODY, BACKEND_TYPE, BACKEND_URL, BACKEND_API_KEY, OFFLINE,
};
