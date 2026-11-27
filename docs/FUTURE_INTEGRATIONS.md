# Future Integrations & Research Backlog

This document tracks integrations that were researched but **not bundled**.
AegisAi Harness stays local-only; heavy or network-dependent features are
opt-in and must be explicitly enabled. Each entry lists the source, what is
already adapted, what remains, and feasibility.

For the **phased, prioritized execution plan**, see the "Phased Integration
Backlog" section in `ROADMAP.md`. This document is the detail matrix.

---

## 1. Phase 1 — Quick Wins (easy + high fit)

### Dataset tools — eelbaz/datasetexplorer (91⭐)
- **Source:** https://github.com/LostRuins/datasetexplorer (MIT)
- **What it is:** single-file, zero-dependency JSON/JSONL dataset viewer/editor for LLM training — Alpaca/ShareGPT/Text formats, regex search/filter, n-gram viewer + word cloud, split/merge/dedup, inline editor, handles ~400 MB.
- **Plan:** `src/dataset.js` with `dataset_view`, `dataset_filter`, `dataset_dedupe`, `dataset_split`, `dataset_merge`, `dataset_ngram`; vendor `public/dataset-explorer.html`.
- **Effort:** Easy. **Impact:** Medium–High (complements eval/comprehension work).

### HF model downloader — thad0ctor/llama-server-launcher (133⭐)
- **Source:** https://github.com/thad0ctor/llama-server-launcher (MIT)
- **Current gap:** `src/model_discovery.huggingFacePull()` is a stub.
- **Plan:** real streaming download with progress and checksum verification.
- **Effort:** Easy. **Impact:** Medium.

### Local-inference tuning skill — pmaeria/tune-ik-llama
- **Source:** https://github.com/pmaeria/tune-ik-llama (MIT)
- **What it is:** agent skill with a six-phase procedure (detect hardware → predict fit → baseline → diagnose regime → sweep `--n-cpu-moe` → push context to native max); measured ~95 tok/s on Qwen 3.6 35B-A3B / 16 GB 4060 Ti.
- **Plan:** bundled `SKILL.md` + `tune_llama` tool recording evidence to `metrics_store.js`.
- **Effort:** Easy–Medium. **Impact:** Medium (reproducible tuning).

### Config API hardening — Martossien/dashboard-llm
- **Source:** https://github.com/Martossien/dashboard-llm (MIT)
- **Pattern:** field whitelist, input validation, atomic writes, file locking, CSRF.
- **Plan:** extract reusable `src/safe_config.js`; harden `settings.js`.
- **Effort:** Easy. **Impact:** Medium–High (governance + safety).

### Weekly submodule bump automation — replikeit/ik-llama-cpp-rs
- **Source:** https://github.com/replikeit/ik-llama-cpp-rs (MIT)
- **Pattern:** workflow walks submodule to upstream, bumps patch version, builds, opens PR.
- **Plan:** adapt for `vendor/aegis` updates.
- **Effort:** Easy. **Impact:** Medium (keeps bundled method pack current).

---

## 2. Phase 2 — Core Inference Enhancements

### VRAM fit predictor + launch dry-run — raketenkater/ggrun (284⭐)
- **Source:** https://github.com/raketenkater/ggrun (MIT)
- **What it is:** reads GGUF + hardware (CPU/RAM/GPU/PCIe), computes exact VRAM math, places models across mismatched multi-GPU rigs, emits `llama-server` command, checks fit, supports `--dry-run`, passes unknown flags through.
- **Plan:** `src/model_fit.js` + backend launch `--dry-run`; extend `hardware_autotune`.
- **Effort:** Medium. **Impact:** High (prevents failed loads, enables MoE on small GPUs).

### ik_llama.cpp backend variant — ikawrakow/ik_llama.cpp (3,426⭐)
- **Source:** https://github.com/ikawrakow/ik_llama.cpp (MIT)
- **What it adds:** IQ*_K / IQ*_KT / R4/R8 quants, MLA, fused delta-net, tensor parallel, MTP (NextN), DFlash, MoE flags (`--n-cpu-moe`, `-rtr`, `-fmoe`), better CPU performance.
- **Plan:** first-class backend variant with quant-aware discovery and MoE flags.
- **Critical:** ik and stock llama.cpp export the same `llama_*`/`ggml_*` symbols with incompatible ABIs — **feature-gate one runtime per binary**, never link both.
- **Effort:** Medium. **Impact:** High.

### Exact-fit preflight as a universal pattern (cross-cutting)
- Apply "will it fit and how to split it" preflight to all backends (vLLM, Ollama, llama.cpp, ik).
- **Effort:** Medium. **Impact:** High.

### Prometheus `/metrics` endpoint — Martossien/dashboard-llm
- CPU/RAM/GPU/token rates; feeds `performance_dashboard.js` and InfluxDB export.
- **Effort:** Medium. **Impact:** Medium–High.

### Backend parameter sweeps — VykosX/Llama-Optimizer
- **Source:** https://github.com/VykosX/Llama-Optimizer (MIT)
- GP-Bayesian multi-phase optimization: topology, context ceiling, offload, MoE thread/expert sweeps, MTP draft, IK contrast, sortable HTML report.
- **Plan:** `src/backend_optimizer.js`, time-boxed sweeps → `metrics_store.js` → dashboard.
- **Effort:** Medium. **Impact:** Medium–High.

### Performance Dashboard Web UI panel
- Surface `performance_dashboard` data in `public/admin.html` + docs landing page.
- **Effort:** Medium. **Impact:** Medium.

---

## 3. Phase 3 — Product & UX

### Chat template editor with Jinja + reasoning controls — llama-server-launcher
- Visual editor for `prompt_templates.js`; per-backend config import/export profiles.
- **Effort:** Medium. **Impact:** Medium.

### Single-file offline web UI — LostRuins/lite.koboldai.net (209⭐)
- **Source:** https://github.com/LostRuins/lite.koboldai.net (MIT)
- Zero-dependency single HTML UI; four modes (Story/Adventure/Chat/Instruct); Tavern cards; AI Horde; in-browser TTS.
- **Plan:** `public/lite.html` runnable from `file://`.
- **Effort:** Medium. **Impact:** Medium.

### Tavern character cards / world info / author's notes — koboldcpp + lite
- Roleplay prompt scaffolding in `prompt_templates.js` / `conversation_templates.js`.
- **Effort:** Medium. **Impact:** Medium.

### AI Horde as opt-in provider
- Distributed generation network; network-dependent, disabled in offline mode.
- **Effort:** Medium. **Impact:** Medium.

### Verification certificate signing with Ed25519
- Upgrade `verification_cert.js` from content-hash only to optional local-key signatures.
- **Effort:** Medium. **Impact:** Medium (trust & audit).

### Lean 4 verification as a release gate
- Wire `lean_verify_project` into CI governance for formal claims.
- **Effort:** Medium. **Impact:** Medium.

### Unified model-store bridging beyond Ollama/LM Studio
- Extend `model_registry.js` with copy/sync for llama.cpp, vLLM cache, HuggingFace cache.
- **Effort:** Medium. **Impact:** Medium.

---

## 4. Phase 4 — Heavy / Native

### In-process inference in Tauri via Rust bindings — replikeit/ik-llama-cpp-rs
- **Source:** https://github.com/replikeit/ik-llama-cpp-rs (MIT)
- Safe Rust bindings mirroring `llama-cpp-2`; weekly upstream bump workflow; ABI incompatibility warning.
- **Plan:** optional Tauri feature flag; feature-gate one runtime.
- **Effort:** High. **Impact:** High.

### Multi-modal generation — LostRuins/koboldcpp (12,411⭐) + stable-ui + stable-diffusion.cpp
- Image (SD1.5/SDXL/SD3/Flux/Qwen Image), video (WAN 2.2/LTX2.3), voice (Whisper STT, Qwen3TTS, Kokoro TTS), music (ACE Step) via one backend.
- **Effort:** High. **Impact:** Medium–High.

### Parallel GPU weight loading — sergey-automation/parallel-gpu-weight-loading
- Faster model load for llama.cpp/ik. **Effort:** High. **Impact:** Medium.

### ik_llama Docker profile — adambenhassen/llama-swap-ik
- Compose profile for ik server alongside mainline. **Effort:** Medium. **Impact:** Medium.

### Phishing domain blocklist — LostRuins/phishing-database
- Optional feed into `url_validate.js` SSRF guard (verify freshness first). **Effort:** Easy. **Impact:** Medium.

---

## 5. Phase 5 — Research-Grade (opt-in, external toolchains / GPU)

| Project | Source | Already adapted | Remaining | Effort | Impact |
|---|---|---|---|---|---|
| mLattice | eelbaz/mLattice | — | PyTorch/CUDA 9-cell memory kernel | H | H |
| JIT LoRA | eelbaz/jit-lora | ≥33% guard in `memory_policy.js` | MLX training loop | H | H |
| MIRAS / Titans | eelbaz/olmo3-miras | surprise scoring in `memory_policy.js` | gradient memory module | H | H |
| MoE expert prefetch | eelbaz/tensorbend-predictor | — | router prediction + NVMe/DRAM prefetch | H | M |
| Recursive-Self-Improving-Loopers | eelbaz/Recursive-Self-Improving-Loopers | `convergence.js` | loop-control weight editing | H | M |
| peerhive p2p QUIC | eelbaz/peerhive | — | A2A/ACP p2p transport | H | M |

---

## 6. Phase 6 — Community / Ecosystem

- Model interoperability standard — contribute the dedup/registry layer as a shared spec.
- Optional-research-module marketplace — lazy submodule discovery generalized to community modules.
- Hardware profile contributions — community-submitted profiles beyond DGX Spark/Apple Silicon/Blackwell.
- Offline-first verification network — peers exchange verification certificates without a central service.

---

## 6b. llamafile & ik_llama.cpp Pages 1–4 (added 2026-11-27)

| Repo | Stars | Idea | Phase |
|---|---|---|---|
| antoinezambelli/forge | 2,271 | Tool-call guardrails: rescue parsing, retry nudges, response validation; proxy mode; 26-scenario eval | 1 |
| mozilla-ai/llamafile | 26,733 | Single-file APE distribution (Cosmopolitan + zip-aligned GGUF) + whisperfile STT | 2/4 |
| mozilla-ai/llamafile-builder | 9 | JSON recipes for runtime+model+GPU-libs builds; HF registry; resume+SHA256 | 1/4 |
| asg017/sqlite-rembed | 155 | SQLite virtual-table pattern for embedding clients (llamafile/Ollama/OpenAI/Nomic) | 2 |
| HyperMink/inferenceable | 15 | Node.js inference server on llama.cpp + llamafile core; GBNF grammars; vision | 2/4 |
| jordandevai/IK-LLama-Proxy | 0 | OpenAI-compat proxy with reliable tool calling for ik backend | 2 |
| kdeps/kdeps | 38 | Workflow-as-YAML with event listeners (API/webhook/Telegram/Slack/Discord) | 3 |
| gabrielursan-beep/red-alert-llm | 14 | Offline knowledge pack on USB: Wikipedia + encrypted vault, 119 languages | 3 |
| steadfastgaze/mlx-iqk | 0 | IQ_K codecs + Metal kernels for MLX Apple Silicon routed experts | 4 |
| wepromen/pxq_llama | 0 | PXQ 2/3/4-bit MoE quants + fused CUDA for Pascal/Volta | 4 |
| ambassadorOfCplusPlus/memex-engine | 0 | MoE engine for weak hardware: static-on-GPU + resident-CPU experts | 4 |
| PhilAnderson1/minicpm-pi5 | 0 | Raspberry Pi 5 ARM optimization for ik_llama.cpp | 4 |
| pantalipe/cpu-llm-bench | 0 | Pre-AVX2 CPU benchmarks + patches | 4 |
| f1zz1ec0ke/ik_fe | 0 | Minimal ik_llama web UI (sampling controls) | future |

**License note:** llamafile = Apache-2.0, forge = MIT, sqlite-rembed = MIT,
inferenceable = Apache-2.0, red-alert-llm = MIT. All can be adapted with attribution.

---

## 7. Cross-Project Patterns Worth Reusing

| Pattern | Source | Where it applies |
|---|---|---|
| Exact-fit preflight | ggrun | All backends before model load |
| Skill-driven hardware tuning | tune-ik-llama | Aegis skill pack delivery |
| Config API hardening | dashboard-llm | `settings.js` → `safe_config.js` |
| Prometheus `/metrics` | dashboard-llm | Standard observability interface |
| ABI-aware backend gating | ik-llama-cpp-rs | Native runtime isolation |
| Weekly upstream bump | ik-llama-cpp-rs | `vendor/aegis` submodule updates |
| Measured-evidence reporting | tune-ik-llama, Llama-Optimizer | Bounded claims with hardware context |
| Single-file zero-dep UI | datasetexplorer, lite.koboldai | Offline-first fallback tools |

---

## Decision Principles

1. **Local-only by default** — no telemetry, no phone-home; network tools disabled in offline mode.
2. **Opt-in heavy tools** — research modules discovered lazily, never bundled.
3. **Provenance** — all adapted patterns attributed in `THIRD_PARTY_NOTICES.md`.
4. **Measured, not claimed** — bounded evidence with hardware context, not universal claims.
5. **No completion without evidence** — governance gates apply to harness development itself.
6. **ABI-aware backend gating** — declare runtime ABI contracts; never load conflicting native runtimes.
7. **Config safety** — whitelist fields, validate inputs, atomic writes, file locking.
8. **Exact-fit preflight** — predict whether a model fits before attempting to load it.

---

See also: `ROADMAP.md` (phased backlog), `CHANGELOG.md`, `THIRD_PARTY_NOTICES.md`,
`docs/DGX_SPARK.md`, `docs/LEAN_VERIFY.md`.
