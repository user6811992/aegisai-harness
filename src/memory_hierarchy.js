// src/memory_hierarchy.js
// Memory hierarchy (L0 capture → L1 episode → L2 fact → L3 skill) + verification ladder.
const db = require('./storage/db');
const temporal = require('./temporal_memory');

function layer(name) {
  try {
    if (name === 'L0') return db.get().prepare('SELECT COUNT(*) n FROM context_episodes').get().n;
    if (name === 'L1') return db.get().prepare('SELECT COUNT(*) n FROM context_episodes').get().n;
    if (name === 'L2') return db.get().prepare('SELECT COUNT(*) n FROM memories').get().n + db.get().prepare('SELECT COUNT(*) n FROM temporal_memories').get().n;
    if (name === 'L3') return db.get().prepare('SELECT COUNT(*) n FROM skills').get().n;
  } catch (e) {}
  return 0;
}
function status() {
  return { L0_capture: layer('L0'), L1_episode: layer('L1'), L2_fact: layer('L2'), L3_skill: layer('L3') };
}
function promoteEpisode(episodeId, text, source) {
  const id = temporal.remember(text || 'episode ' + episodeId, source || 'episode:' + episodeId, ['promoted']);
  return { id, from: episodeId, layer: 'L2' };
}
function verificationLadder(fact) {
  return {
    fact,
    levels: [
      { level: 1, name: 'observed', met: !!(fact && fact.source) },
      { level: 2, name: 'corroborated', met: false },
      { level: 3, name: 'independently verified', met: false },
    ],
  };
}

module.exports = { status, promoteEpisode, verificationLadder, layer };
