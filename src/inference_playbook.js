// src/inference_playbook.js
// Universal inference-optimization methodology skill — hardware-agnostic.
// Clean-room adaptation of ideas from alesha-pro/inference-optimization-playbook
// (138 tested consumer-GPU MoE hypotheses). This is a METHOD, not a fixed set
// of flags: it works on any hardware (CPU-only, single GPU, multi-GPU, Apple
// Silicon, DGX Spark, AMD, NVIDIA) by measuring before/after, never guessing.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { DATA_DIR } = require('./core/config');

const SKILL_NAME = 'tune-local-inference';
const SKILL_DESCRIPTION = 'Evidence-driven local inference tuning for ANY hardware: measure a baseline, form one hypothesis, change one variable, re-measure, and keep only what helps.';

// Universal hypotheses — each is a *test*, not a recommendation. The agent
// picks candidates relevant to the detected hardware and measures each.
const HYPOTHESES = {
  placement: [
    { id: 'all-in-vram', test: 'Does the whole model fit in VRAM? Try -ngl 99 / tensor-parallel and measure tok/s + TTFT.', applies: ['nvidia', 'amd', 'apple'] },
    { id: 'expert-offload', test: 'For MoE, offload cold experts to RAM (-n-cpu-moe N) and sweep N; keep hot experts in VRAM.', applies: ['nvidia', 'amd', 'cpu'] },
    { id: 'tensor-parallel', test: 'With >=2 GPUs, compare layer split vs tensor parallel for decode tok/s.', applies: ['multi-gpu'] },
    { id: 'kv-in-vram', test: 'Gather attention K/V into VRAM once per chunk; measure long-context prefill.', applies: ['nvidia', 'amd'] },
  ],
  quantization: [
    { id: 'quant-sweep', test: 'Compare Q4_K_M / Q5_K / IQ*_K / NVFP4 / FP8 at equal context; record quality + speed.', applies: ['any'] },
    { id: 'imatrix', test: 'Use an importance-matrix (imatrix) quant for the same bpw; compare perplexity.', applies: ['any'] },
    { id: 'kvcache-quant', test: 'Quantize K/V cache (q8_0/q4) to extend context; measure quality loss.', applies: ['any'] },
  ],
  decoding: [
    { id: 'speculative', test: 'Enable a draft/speculative decoder (DFlash/MTP); measure acceptance rate and decode gain.', applies: ['nvidia', 'amd', 'apple'] },
    { id: 'draft-vocab', test: 'For non-English work, tailor draft vocabulary to the language; measure acceptance.', applies: ['any'] },
    { id: 'cuda-graph', test: 'Use one CUDA graph per token / batch; measure short-prompt decode.', applies: ['nvidia'] },
  ],
  context: [
    { id: 'chunked-prefill', test: 'Enable automatic chunked prefill; measure long-prompt TTFT.', applies: ['any'] },
    { id: 'prompt-layer-skip', test: 'Skip redundant prompt layers (where supported); measure prefill speed.', applies: ['any'] },
    { id: 'depth-bench', test: 'Benchmark at REAL context depth, not on an empty context.', applies: ['any'] },
  ],
  system: [
    { id: 'pinned-ram-dma', test: 'Use pinned RAM / DMA for expert transfers; measure cold-expert latency.', applies: ['nvidia', 'amd', 'cpu'] },
    { id: 'cpu-kernel-path', test: 'Disable slow CPU kernel paths (e.g. PDEP) at build time; measure cold-expert time.', applies: ['cpu', 'nvidia', 'amd'] },
    { id: 'thermal-power', test: 'Check thermal throttling/power limits before attributing slowness to the model.', applies: ['any'] },
  ],
};

const TRAPS = [
  'Change ONE variable per experiment; otherwise you cannot attribute the gain.',
  'Always record the exact command, hardware, model, quant, context length, and measurement — provenance matters.',
  'Benchmark at the context depth you actually use, not an empty context.',
  'Report both prefill (TTFT) and decode (tok/s); a win in one can be a loss in the other.',
  'A hypothesis that fails is still valuable — record the negative result so others do not repeat it.',
  'Fails closed: only keep a setting if the re-measured result is better within noise.',
  'Hardware-specific results do NOT generalize — treat every case as a local measurement, not a universal claim.',
];

const BODY = `# ${SKILL_NAME}

${SKILL_DESCRIPTION}

## Why this works everywhere
This skill does NOT hardcode flags for one GPU. It teaches a **measurement loop**
that works on CPU-only laptops, a single 8 GB card, multi-GPU rigs, Apple Silicon,
AMD, and DGX-class machines. Your hardware only decides WHICH hypotheses are
applicable — the method is identical.

## The loop
1. **Baseline** — run the model with default settings at your real context depth;
   record tok/s (decode), TTFT (prefill), VRAM/RAM used, and the exact command.
2. **Detect hardware** — use \`hardware_detect\` / \`hardware_autotune\`; note GPU(s),
   VRAM, RAM, CPU features, backend.
3. **Pick ONE hypothesis** from the applicable list below for your hardware.
4. **Change one variable.** Re-measure with the same prompt and context.
5. **Keep or revert** — only keep if the gain is real (outside noise). Record the
   verdict, positive or negative, in \`metrics_store\` / \`docs/INFERENCE_PLAYBOOK.md\`.
6. **Repeat** until gains plateau or time budget is exhausted.

## Hypothesis catalog (pick by hardware applicability: any/nvidia/amd/cpu/apple/multi-gpu)
${Object.entries(HYPOTHESES).map(([group, list]) => `### ${group}\n${list.map((h) => `- **${h.id}** [${h.applies.join(', ')}] — ${h.test}`).join('\n')}`).join('\n\n')}

## Hardware examples (illustrative only — NOT defaults)
- **8 GB GPU (e.g. RX 5700 XT) + 6 GB GPU (GTX 1660 Super), 32 GB RAM, 6-core CPU:**
  MoE expert-offload is the first hypothesis to test; a small dense model fully in
  VRAM is the baseline. Measure, do not assume.
- **24 GB+ card:** all-in-VRAM + KV-in-VRAM first.
- **Multi-GPU:** tensor-parallel vs layer-split sweep.
- **Apple Silicon:** MLX path + KV cache quantization; check unified-memory pressure.
- **CPU-only:** pinned-RAM DMA and CPU-kernel-path hypotheses; smaller quants.

## Traps
${TRAPS.map((t) => '- ' + t).join('\n')}

## Rules
- Use the agent's existing shell and the harness's \`hardware_*\` tools. No new tools.
- Be **universal**: never present one machine's number as a general truth.
- Report bounded evidence with hardware context, like "measured X tok/s on <exact hardware> at <exact context>".
- Network-free; respects offline mode.
`;

function skill() { return { name: SKILL_NAME, description: SKILL_DESCRIPTION, body: BODY }; }

function install() {
  const dir = path.join(DATA_DIR, 'skills', SKILL_NAME);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, 'SKILL.md');
  fs.writeFileSync(p, `---\nname: ${SKILL_NAME}\ndescription: ${SKILL_DESCRIPTION}\n---\n\n` + BODY);
  return { ok: true, name: SKILL_NAME, path: p };
}

// Filter hypotheses by a hardware profile id (universal applicability model).
function applicableFor(profileId, gpuInfo) {
  const tags = new Set(['any']);
  const p = String(profileId || '').toLowerCase();
  const g = String(gpuInfo || '').toLowerCase();
  if (/dgx|blackwell|nvidia|cuda/.test(p + g)) tags.add('nvidia');
  if (/amd|radeon|rx\s?\d/.test(g)) tags.add('amd');
  if (/apple|mlx|m[1-9]/.test(p + g)) tags.add('apple');
  if (/cpu|generic|intel|ryzen|xeon/.test(p + g)) tags.add('cpu');
  if (/multi|2x|4x|\dtensor|3090/.test(p + g)) tags.add('multi-gpu');
  const out = {};
  for (const [group, list] of Object.entries(HYPOTHESES)) {
    out[group] = list.filter((h) => h.applies.some((a) => tags.has(a)));
  }
  return { profile: profileId || 'unknown', tags: Array.from(tags), groups: out };
}

// A minimal, universal experiment record shape.
function experiment(opts) {
  return {
    id: 'exp_' + Date.now().toString(36),
    ts: new Date().toISOString(),
    hardware: opts.hardware || 'unknown',
    model: opts.model || 'unknown',
    quant: opts.quant || null,
    context: opts.context || null,
    command: opts.command || '',
    hypothesis: opts.hypothesis || 'baseline',
    baseline: opts.baseline || null,
    measured: opts.measured || null,
    verdict: opts.verdict || 'pending',
    note: opts.note || '',
  };
}

function tools() {
  return [
    { name: 'tune_playbook_skill', description: 'Read or install the universal tune-local-inference skill.', inputSchema: { type: 'object', properties: { install: { type: 'boolean' } } } },
    { name: 'tune_playbook_hypotheses', description: 'List applicable optimization hypotheses for a hardware profile.', inputSchema: { type: 'object', properties: { profile: { type: 'string' }, gpu: { type: 'string' } } } },
    { name: 'tune_playbook_record', description: 'Build a provenance-rich experiment record.', inputSchema: { type: 'object', properties: { hardware: { type: 'string' }, model: { type: 'string' }, hypothesis: { type: 'string' } } } },
  ];
}

function dispatch(name, args) {
  args = args || {};
  if (name === 'tune_playbook_skill') return args.install ? install() : Object.assign({ ok: true }, skill());
  if (name === 'tune_playbook_hypotheses') return Object.assign({ ok: true }, applicableFor(args.profile, args.gpu));
  if (name === 'tune_playbook_record') return Object.assign({ ok: true }, experiment(args));
  throw new Error('unknown tune playbook tool: ' + name);
}

module.exports = {
  SKILL_NAME, SKILL_DESCRIPTION, HYPOTHESES, TRAPS, BODY,
  skill, install, applicableFor, experiment, tools, dispatch,
};
