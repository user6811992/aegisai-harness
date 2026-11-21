// src/agents/profiles.js
// Named agent profiles: system prompt + tool/model/permission config.
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('../core/config');

const DEFAULT_PROFILES = {
  default: {
    name: 'default',
    systemPrompt: 'You are a helpful local AI agent. Use tools when needed. Be concise.',
    model: null,
    includeCoding: true,
    includeRe: false,
    cleanRoom: false,
    allowedTools: null,
    deniedTools: null,
    sandbox: false,
  },
  coder: {
    name: 'coder',
    systemPrompt: 'You are a coding agent. Read and modify files carefully. Run tests after changes.',
    model: null,
    includeCoding: true,
    includeRe: false,
    cleanRoom: false,
    allowedTools: null,
    deniedTools: null,
    sandbox: true,
  },
  researcher: {
    name: 'researcher',
    systemPrompt: 'You are a research agent. Search files and web. Do not modify files.',
    model: null,
    includeCoding: true,
    includeRe: false,
    cleanRoom: false,
    allowedTools: ['list_files', 'read_file', 'search_files', 'web_search'],
    deniedTools: ['write_file', 'delete_file', 'run_command', 'run_python'],
    sandbox: false,
  },
  'clean-room': {
    name: 'clean-room',
    systemPrompt: 'You work only from observable behavior. Do not read source files.',
    model: null,
    includeCoding: true,
    includeRe: false,
    cleanRoom: true,
    allowedTools: null,
    deniedTools: null,
    sandbox: false,
  },
};

function loadProfiles() {
  const p = path.join(DATA_DIR, 'agents.json');
  let custom = {};
  if (fs.existsSync(p)) {
    try { custom = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { custom = {}; }
  }
  return Object.assign({}, DEFAULT_PROFILES, custom);
}

function getProfile(name) {
  const profiles = loadProfiles();
  return profiles[name] || profiles.default;
}

function saveProfile(name, profile) {
  const p = path.join(DATA_DIR, 'agents.json');
  let custom = {};
  if (fs.existsSync(p)) { try { custom = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { custom = {}; } }
  custom[name] = profile;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(custom, null, 2));
}

module.exports = { DEFAULT_PROFILES, loadProfiles, getProfile, saveProfile };
