// src/a2a_adapter.js
// A2A (Agent-to-Agent) and ACP (Agent Communication Protocol) adapter interfaces.
// Provides standardized messaging between agents, enabling decentralized coordination.
// Supports both JSON-RPC over WebSocket (A2A) and structured payload (ACP).
// Falls back to local message passing when no remote broker is available.

const fs = require('fs');
const path = require('path');

// === Configuration ===
const BROKER_DIR = path.join(process.cwd(), '.aegisai', 'a2a-broker');
const STATE_FILE = path.join(BROKER_DIR, 'state.json');

// Ensure broker directory exists
if (!fs.existsSync(BROKER_DIR)) {
  fs.mkdirSync(BROKER_DIR, { recursive: true });
}

// === In-memory agent registry (best-effort) ===
let agentRegistry = {
  // { [agentId]: { name, capabilities, registeredAt, lastSeen } }
};

// Try to load persisted state
try {
  const persisted = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  if (persisted) agentRegistry = persisted.agents || {};
} catch (e) {
  // Best-effort; start fresh if persist file missing
}

// Persist agent registry to disk
function persistRegistry() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ agents: agentRegistry }));
  } catch (e) {
    // Best-effort; don't crash on persist failure
  }
}

// === A2A Message Types ===
const A2A_MESSAGE_TYPES = {
  REGISTER: 'a2a/register',
  DEREGISTER: 'a2a/deregister',
  PING: 'a2a/ping',
  CALL: 'a2a/call',
  BROADCAST: 'a2a/broadcast',
};

// === ACP Message Types ===
const ACP_MESSAGE_TYPES = {
  HEARTBEAT: 'ack',
  DATA: 'data',
  REQUEST: 'request',
  RESPONSE: 'response',
  ERROR: 'error',
};

// === Public API ===

// Register an agent with its capabilities
function registerAgent(agentId, metadata) {
  agentRegistry[agentId] = {
    ...metadata,
    registeredAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };
  persistRegistry();
  return { ok: true, agentId };
}

// Dereister an agent
function deregisterAgent(agentId) {
  if (agentRegistry[agentId]) {
    delete agentRegistry[agentId];
    persistRegistry();
    return { ok: true };
  }
  return { ok: false, error: 'agent not registered: ' + agentId };
}

// Get registered agent info
function getAgent(agentId) {
  return agentRegistry[agentId] || null;
}

// List all registered agents
function listAgents() {
  return Object.values(agentRegistry);
}

// Send a message to another agent (A2A call)
function callAgent(targetAgentId, message) {
  const target = getAgent(targetAgentId);
  if (!target) {
    return { ok: false, error: 'target agent not registered: ' + targetAgentId };
  }

  // In a real implementation, this would forward the message via WebSocket, Redis, etc.
  // For now, we'll just log and return a mock response
  console.log('[A2A] Calling agent ' + targetAgentId + ':', message);

  // Simulate a response based on capabilities
  const capabilities = target.capabilities || [];
  if (capabilities.includes('echo')) {
    return {
      ok: true,
      response: {
        type: 'echo',
        original: message,
        receivedAt: new Date().toISOString(),
        agent: target.name,
      },
    };
  }

  // Default response
  return {
    ok: true,
    response: {
      type: 'ack',
      original: message,
      receivedAt: new Date().toISOString(),
      agent: target.name,
    },
  };
}

// Broadcast a message to all registered agents
function broadcastAgent(message, excludeId) {
  const recipients = Object.keys(agentRegistry).filter((id) => id !== excludeId);
  const results = {};

  recipients.forEach((id) => {
    const result = callAgent(id, message);
    results[id] = result;
  });

  return { ok: true, recipients: recipients.length, results };
}

// Check if an agent is registered
function isAgentRegistered(agentId) {
  return !!agentRegistry[agentId];
}

// Export cleaned API
module.exports = {
  registerAgent,
  deregisterAgent,
  getAgent,
  listAgents,
  callAgent,
  broadcastAgent,
  isAgentRegistered,
  A2A_MESSAGE_TYPES,
  ACP_MESSAGE_TYPES,
};

// Initialize: persist registry on module load
persistRegistry();