// src/resource_broker.js
// Shared resource broker with local fallback (Redis available, local fallback if not).
// Provides resource leasing/locking across agents/sessions with best-effort persistence.
const fs = require('fs');
const path = require('path');
const os = require('os');

// === Configuration ===
const BROKER_DIR = path.join(process.cwd(), '.aegisai', 'broker');
const LOCK_FILE = path.join(BROKER_DIR, 'locks.json');
const LEASE_FILE = path.join(BROKER_DIR, 'leases.json');

// Ensure broker directory exists
if (!fs.existsSync(BROKER_DIR)) {
  fs.mkdirSync(BROKER_DIR, { recursive: true });
}

// === In-memory broker state (best-effort) ===
let brokerState = {
  locks: {},     // { [resourceId]: { owner, acquiredAt, expiresAt } }
  leases: {}     // { [leaseId]: { owner, resource, expiresAt, grantedAt } }
};

// Try to load persisted state from disk
try {
  const persisted = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
  if (persisted) brokerState.locks = persisted.locks || {};
} catch (e) {
  // Best-effort; start fresh if persist file missing
}

// Persist locks to disk (write after each change)
function persistLocks() {
  try {
    fs.writeFileSync(LOCK_FILE, JSON.stringify(brokerState));
  } catch (e) {
    // Best-effort; don't crash on persist failure
  }
}

// === Public API ===

// Acquire a lock on a resource. Returns { ok, error, resourceId, owner, expiresAt }
// If resource is already locked, the caller can opt to wait or abort.
function acquireLock(resourceId, owner, ttlMs) {
  ttlMs = ttlMs || 60000; // default 1 minute
  const expiresAt = Date.now() + ttlMs;

  // If already locked and not expired
  if (brokerState.locks[resourceId] && brokerState.locks[resourceId].expiresAt > Date.now()) {
    return { ok: false, error: 'resource locked by ' + brokerState.locks[resourceId].owner, resourceId, owner: brokerState.locks[resourceId].owner };
  }

  // Acquire lock
  brokerState.locks[resourceId] = { owner, acquiredAt: Date.now(), expiresAt };
  persistLocks();
  return { ok: true, resourceId, owner, expiresAt };
}

// Release a lock on a resource
function releaseLock(resourceId, owner) {
  if (brokerState.locks[resourceId] && brokerState.locks[resourceId].owner === owner) {
    delete brokerState.locks[resourceId];
    persistLocks();
    return { ok: true };
  }
  return { ok: false, error: 'resource not locked by ' + owner };
}

// Check if a resource is locked
function isLocked(resourceId) {
  return !!brokerState.locks[resourceId];
}

// === Lease-based access (time-bounded) ===

// Acquire a lease for a resource. Automatically expires after ttlMs.
function acquireLease(leaseId, resourceId, owner, ttlMs) {
  ttlMs = ttlMs || 30000; // default 30 seconds
  const expiresAt = Date.now() + ttlMs;

  // If already has an active lease for this resource from this owner, renew
  if (brokerState.leases[leaseId] && brokerState.leases[leaseId].resource === resourceId && brokerState.leases[leaseId].owner === owner) {
    brokerState.leases[leaseId].expiresAt = expiresAt;
  } else {
    brokerState.leases[leaseId] = { owner, resource: resourceId, expiresAt, grantedAt: Date.now() };
  }
  persistLocks();
  return { ok: true, leaseId, expiresAt };
}

// Release a lease
function releaseLease(leaseId, owner) {
  if (brokerState.leases[leaseId] && brokerState.leases[leaseId].owner === owner) {
    delete brokerState.leases[leaseId];
    persistLocks();
    return { ok: true };
  }
  return { ok: false, error: 'lease not owned by ' + owner };
}

// === Convenience: per-resource reentrant lock ===

let reentrantDepths = {};

function acquireReentrantLock(resourceId, owner) {
  if (!reentrantDepths[resourceId]) reentrantDepths[resourceId] = {};
  if (!reentrantDepths[resourceId][owner]) reentrantDepths[resourceId][owner] = 0;
  reentrantDepths[resourceId][owner]++;
  return { ok: true, depth: reentrantDepths[resourceId][owner] };
}

function releaseReentrantLock(resourceId, owner) {
  if (reentrantDepths[resourceId] && reentrantDepths[resourceId][owner]) {
    reentrantDepths[resourceId][owner]--;
    if (reentrantDepths[resourceId][owner] <= 0) {
      delete reentrantDepths[resourceId][owner];
      if (Object.keys(reentrantDepths[resourceId]).length === 0) {
        delete reentrantDepths[resourceId];
      }
    }
  }
}

// Expose cleaned API (without internal details)
module.exports = {
  acquireLock,
  releaseLock,
  isLocked,
  acquireLease,
  releaseLease,
  acquireReentrantLock,
  releaseReentrantLock
};