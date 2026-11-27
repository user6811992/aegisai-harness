// src/character_cards.js
// Tavern-style character cards / world info / author's notes — clean-room
// koboldcpp + lite.koboldai.net idea. Parse character metadata from JSON cards
// and character book (world info) entries; assemble a prompt with author's notes.
function normalize(card) {
  return {
    name: card.name || 'Unnamed',
    description: card.description || '',
    personality: card.personality || '',
    scenario: card.scenario || '',
    firstMes: card.first_mes || card.firstMes || '',
    exampleDialogue: card.example_dialogue || card.mes_example || '',
    creator: card.creator || '',
    tags: card.tags || [],
  };
}

function prompt(card, opts) {
  opts = opts || {};
  const c = normalize(card);
  const parts = [];
  if (c.description) parts.push(`[${c.name}]\n${c.description}`);
  if (c.personality) parts.push(`Personality: ${c.personality}`);
  if (c.scenario) parts.push(`Scenario: ${c.scenario}`);
  const world = (card.character_book && card.character_book.entries) || opts.worldInfo || [];
  for (const e of world) {
    const keys = (e.keys || []).join(', ');
    parts.push(`[World Info: ${keys || 'always'}] ${e.content || ''}`);
  }
  if (c.exampleDialogue) parts.push(`Example dialogue:\n${c.exampleDialogue}`);
  if (opts.authorsNote || card.creator_notes) parts.push(`Author's note: ${opts.authorsNote || card.creator_notes}`);
  return { ok: true, name: c.name, prompt: parts.join('\n\n') };
}

function fromJSON(json) {
  try { return { ok: true, card: normalize(JSON.parse(json)) }; }
  catch (e) { return { ok: false, error: 'invalid character card JSON' }; }
}

function tools() {
  return [
    { name: 'character_parse', description: 'Parse a Tavern-style character card from JSON.', inputSchema: { type: 'object', properties: { json: { type: 'string' } }, required: ['json'] } },
    { name: 'character_prompt', description: 'Assemble a roleplay prompt with world info and author notes.', inputSchema: { type: 'object', properties: { card: { type: 'object' }, authorsNote: { type: 'string' } }, required: ['card'] } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'character_parse') return fromJSON(args.json);
  if (name === 'character_prompt') return prompt(args.card, args);
  throw new Error('unknown character_cards tool: ' + name);
}
module.exports = { normalize, prompt, fromJSON, tools, dispatch };
