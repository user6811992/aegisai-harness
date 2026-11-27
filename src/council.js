// src/council.js
// Council of High Intelligence — clean-room 0xNyk/council-of-high-intelligence
// (MIT). Structured multi-perspective deliberation: independent first positions,
// forced disagreement, verdict preserving dissent / kill criteria / next action.
// Local-only, deterministic scaffolding (the agent supplies reasoning).
const PERSONAS = [
  { id: 'skeptic', lens: 'risks, failure modes, and why this could be wrong' },
  { id: 'pragmatist', lens: 'cost, effort, reversibility, and the smallest viable step' },
  { id: 'visionary', lens: 'second-order effects and long-term upside' },
  { id: 'operator', lens: 'execution: who does what, by when, with what evidence' },
];

function convene(question, opts) {
  opts = opts || {};
  const mode = opts.mode || 'council';
  let personas = PERSONAS;
  if (mode === 'duo') personas = [PERSONAS[0], PERSONAS[1]];
  if (mode === 'quick') personas = [PERSONAS[0], PERSONAS[2], PERSONAS[3]];
  return {
    ok: true,
    question,
    mode,
    personas: personas.map((p) => ({
      id: p.id, lens: p.lens,
      prompt: `Independently assess: "${question}". Focus on ${p.lens}. Give a position and top 3 pieces of evidence. Do not consult other positions yet.`,
    })),
    phases: [
      'independent first positions',
      'forced disagreement (each responds to another position)',
      'verdict: preserve unresolved questions, dissent, kill criteria, next concrete action',
    ],
    verdictSchema: { decision: '', confidence: 0, dissent: [], killCriteria: [], unresolved: [], nextAction: '' },
  };
}

function recordDeliberation(id, positions, verdict) {
  return {
    ok: true,
    id: id || 'council_' + Date.now().toString(36),
    ts: new Date().toISOString(),
    positions: positions || [],
    verdict: verdict || {},
    note: 'dissent and kill criteria must be preserved, not smoothed away',
  };
}

function tools() {
  return [
    { name: 'council_convene', description: 'Set up a multi-perspective deliberation on a hard decision.', inputSchema: { type: 'object', properties: { question: { type: 'string' }, mode: { type: 'string', enum: ['council','quick','duo'] } }, required: ['question'] } },
    { name: 'council_record', description: 'Record positions and a verdict with preserved dissent.', inputSchema: { type: 'object' } },
  ];
}
function dispatch(name, args) {
  args = args || {};
  if (name === 'council_convene') return convene(args.question, args);
  if (name === 'council_record') return recordDeliberation(args.id, args.positions, args.verdict);
  throw new Error('unknown council tool: ' + name);
}
module.exports = { PERSONAS, convene, recordDeliberation, tools, dispatch };
