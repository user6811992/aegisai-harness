# Future Integrations & Research Backlog

This document tracks integrations that were researched but **not bundled**.
AegisAi Harness stays local-only; heavy or network-dependent features are
opt-in and must be explicitly enabled. Each entry lists the source, what is
already adapted, what remains, and feasibility.

---

## 1. Research-Grade Integrations (require external toolchains / GPU)

### mLattice — linear-memory architecture
- **Source:** [eelbaz/mLattice](https://github.com/eelbaz/mLattice) (MIT)
- **What it is:** 9 cells read/written per token on a 2D lattice; flat per-token cost at 131K tokens (7,280× fewer ops than attention).
- **Already adapted:** nothing (architecture is research-grade).
- **Remaining:** Python/PyTorch kernel as an optional long-context backend, exposed through `optional_modules` and called as a tool.
- **Feasibility:** Low (research kernel + CUDA). **Impact:** High (unlimited context).

### JIT LoRA — continuous in-conversation learning
- **Source:** [eelbaz/jit-lora](https://github.com/eelbaz/jit-lora) (MIT)
- **What it is:** Rewrites model weights mid-conversation via MLX-native LoRA; ≥33% regularization ratio prevents catastrophic forgetting.
- **Already adapted:** the ≥33% regularization guard in `src/memory_policy.js`.
- **Remaining:** full MLX/Apple Silicon training loop; not portable to Node.
- **Feasibility:** Low (needs ML runtime). **Impact:** High (persistent knowledge).

### MIRAS / Titans neural long-term memory
- **Source:** [eelbaz/olmo3-miras](https://github.com/eelbaz/olmo3-miras) (MIT)
- **What it is:** Surprise-driven associative memory with test-time learning and adaptive forget gates.
- **Already adapted:** surprise scoring for consolidation in `src/memory_policy.js`.
- **Remaining:** neural memory module with gradient-based updates (PyTorch).
- **Feasibility:** Medium. **Impact:** High.

### MoE expert prefetch predictor
- **Source:** [eelbaz/tensorbend-predictor](https://github.com/eelbaz/tensorbend-predictor) (MIT)
- **What it is:** Predicts router expert selection before the gate; prefetches weights from NVMe/DRAM (99.8% train / 96.9% live accuracy).
- **Already adapted:** nothing.
- **Remaining:** low-level vLLM/ggml integration for local MoE models.
- **Feasibility:** Low. **Impact:** Medium (MoE throughput).

### peerhive — p2p pubsub over QUIC
- **Source:** [eelbaz/peerhive](https://github.com/eelbaz/peerhive) (MIT)
- **What it is:** p2p pubsub media network over QUIC.
- **Already adapted:** nothing.
- **Remaining:** extend A2A/ACP adapters (`src/a2a.js`, `src/a2a_adapter.js`) with a p2p transport.
- **Feasibility:** Low (distributed systems). **Impact:** Medium (distributed multi-agent).

### Recursive-Self-Improving-Loopers — fixed-point self-improvement
- **Source:** [eelbaz/Recursive-Self-Improving-Loopers](https://github.com/eelbaz/Recursive-Self-Improving-Loopers) (MIT)
- **What it is:** SelfWrite + Banach fixed-point alignment for looped MoE transformers.
- **Already adapted:** fixed-point convergence detection in `src/convergence.js`.
- **Remaining:** loop-control weight editing (requires model-level access).
- **Feasibility:** Low. **Impact:** Medium.

---

## 2. Product Enhancements (feasible, not scheduled)

| # | Idea | Current state | Remaining work | Impact |
|---|---|---|---|---|
| 1 | Broader model-store bridging | `src/model_bridge.js` (Ollama↔LM Studio) | Extend `src/model_registry.js` with copy/sync for llama.cpp, vLLM cache, HuggingFace cache | Medium |
| 2 | Signed verification certificates | `src/verification_cert.js` (content hash) | Add optional Ed25519 signatures with a local key | Medium |
| 3 | Lean 4 as a release gate | `src/lean_verify.js` (opt-in tool) | Wire into CI governance for formal claims | Medium |
| 4 | Dashboard in Web UI | `src/performance_dashboard.js` (data layer) | Add panel to `public/admin.html` and docs landing page | Medium |
| 5 | Per-subscription quota windows | not started | Usage analytics by Claude/OpenCode/Cursor windows (apiad/aegis pattern) | Medium |
| 6 | Agent groups / broadcast in Web UI | Tauri tray IPC only | Add group coordination panel to the web UI | Medium |

---

## 3. Cross-Project Patterns Worth Reusing

| Pattern | Source | Where it could apply |
|---|---|---|
| Hardware-specific setup scripts | `dgx-spark-vllm-setup`, `nvfp4-quantization` | More `docs/*_SETUP.md` profiles + `hardware.js` detection |
| Per-phase HTTP timing + time-series export | `lyra` | Already in `http_advanced.js` + `influxdb.js`; extend with alerting |
| Opt-in research submodule discovery | `vendor/aegis` + `optional_modules.js` | Generalize to a community module registry |
| Formal verification certificates | `Rule30PrizeKit` + `evidence_bundle.js` | Signed, independently verifiable completion proofs |
| Model-neutral scaffolding blueprints | `harnessforge` | Already in `project_init.js`; extend with more IDE adapters |

---

## 4. Ideas Not Tied to a Specific Repo

- **Unified model interoperability spec** — contribute the dedup/registry layer as a shared standard for local harnesses.
- **Community hardware profiles** — user-submitted GPU/CPU profiles auto-selected in `hardware_autotune.js`.
- **Research-module marketplace** — lazy, opt-in discovery of third-party method packs with provenance in `THIRD_PARTY_NOTICES.md`.
- **Offline-first verification network** — peers exchange verification certificates without a central service.

---

## Decision Principles

1. **Local-only by default** — no telemetry, no phone-home; network tools disabled in offline mode.
2. **Opt-in heavy tools** — research modules are discovered lazily, never bundled.
3. **Provenance** — all adapted patterns attributed in `THIRD_PARTY_NOTICES.md`.
4. **Measured, not claimed** — like Aegis/LinkDigest, report bounded evidence, not universal claims.
5. **No completion without evidence** — governance gates apply to harness development itself.

---

See also: `ROADMAP.md`, `CHANGELOG.md`, `THIRD_PARTY_NOTICES.md`,
`docs/DGX_SPARK.md`, `docs/LEAN_VERIFY.md`.
