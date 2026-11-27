# Third-Party Notices

AegisAi Harness vendors and/or bundles the following third-party components.

## Runtime / optional npm dependencies
- **better-sqlite3** (MIT) — https://github.com/WiseLibs/better-sqlite3
- **pdf-parse** (MIT) — https://github.com/pdfguide/pdf-parse

## Vendored browser assets (public/vendor/)
- **Preact** (MIT) — https://github.com/preactjs/preact
- **htm** (MIT) — https://github.com/developit/htm
- **KaTeX** (MIT) — https://github.com/KaTeX/KaTeX
- **Mermaid** (MIT) — https://github.com/mermaid-js/mermaid
- **Tailwind CSS** (MIT) — https://github.com/tailwindlabs/tailwindcss

## Native library (optional submodule)
- **ggml** (MIT) — Copyright (c) 2023-2026 The ggml authors — https://github.com/ggml-org/ggml
  (see `ggml/LICENSE`)

## Bundled method pack (git submodule)
- **Aegis Method Pack** (MIT) — GanyuanRan/Aegis v2.16.0 — https://github.com/GanyuanRan/Aegis
  - 22 skills bundled under `vendor/aegis`, imported via `src/aegis_skills.js`
  - Governance patterns (baseline-first, evidence-verified, drift-checked) adapted in `src/governance.js`
  - Retains its MIT license; see `vendor/aegis/LICENSE`

## Adapted patterns (attribution)
The following open-source projects inspired features adapted into AegisAi Harness:
- **harnessforge** (MIT) — https://github.com/jcaiagent7143-ui/harnessforge
  - Project blueprints (SOUL.md, TOOLS.md, MEMORY.md, forbidden-path rules, MCP recommendations)
    adapted into `src/project_init.js`
- **aegis** by apiad (MIT) — https://github.com/apiad/aegis
  - Group/broadcast coordination concepts adapted into the Tauri IPC commands (`backend_broadcast`,
    `backend_group_spawn`, `backend_group_status`)
- **linkdigest-mcp** (MIT) — https://github.com/jcaiagent7143-ui/linkdigest-mcp
  - MCP preset for social media content extraction registered in `src/mcp_presets.js`
  - Hosted service operated by LinkDigest; the harness preset does not bundle the reading engine

## Adapted patterns (@eelbaz)
The following projects by Eric Elbaz inspired features adapted into AegisAi Harness:
- **ollama-lmstudio-bridge** (MIT) — https://github.com/eelbaz/ollama-lmstudio-bridge
  - Model-store symlink bridging adapted into `src/model_bridge.js`
- **lyra** (MIT) — https://github.com/eelbaz/lyra
  - Phased HTTP timing metrics and InfluxDB line-protocol export adapted into `src/http_advanced.js` and `src/influxdb.js`
- **cdnshare** (MIT) — https://github.com/eelbaz/cdnshare
  - CDN identification from network metadata adapted into `src/http_advanced.js`
- **dgx-spark-vllm-setup** (MIT) — https://github.com/eelbaz/dgx-spark-vllm-setup
  - DGX Spark / Blackwell hardware profile documented in `docs/DGX_SPARK.md`
- **Rule30PrizeKit** (MIT) — https://github.com/eelbaz/Rule30PrizeKit
  - Optional Lean 4 verification wrapper in `src/lean_verify.js`, documented in `docs/LEAN_VERIFY.md`

## Research patterns (not bundled)
The following research projects inspired pure-JS policy layers in AegisAi Harness.
They are opt-in and never bundled:
- **Recursive-Self-Improving-Loopers** (MIT) — https://github.com/eelbaz/Recursive-Self-Improving-Loopers
  - Fixed-point convergence detection adapted into `src/convergence.js`
- **olmo3-miras** (MIT) — https://github.com/eelbaz/olmo3-miras
  - Surprise-driven memory consolidation policy adapted into `src/memory_policy.js`
- **jit-lora** (MIT) — https://github.com/eelbaz/jit-lora
  - Regularization-ratio guard against catastrophic forgetting adapted into `src/memory_policy.js`
- **mLattice** (MIT) — https://github.com/eelbaz/mLattice
  - Linear-memory architecture documented as an optional research module in `src/optional_modules.js`
- **tensorbend-predictor** (MIT) — https://github.com/eelbaz/tensorbend-predictor
  - MoE expert prefetch documented as an optional research module in `src/optional_modules.js`

## Clean-room implementations (inspired, not copied)
The following projects inspired functionality that was **independently
reimplemented** in AegisAi Harness. No source code was copied; only the ideas
and feature sets were used.
- **datasetexplorer** (AGPL-3.0) — https://github.com/LostRuins/datasetexplorer
  - Dataset curation concepts (JSON/JSONL viewing, composite filters, n-grams,
    dedup, split/merge, find/replace) reimplemented clean-room in `src/dataset.js`.
  - The AGPL-licensed single-file HTML was **not** vendored; MIT-licensed
    aegisai-harness cannot incorporate it. See `docs/DATASET_TOOLS.md`.

All third-party components retain their respective licenses. See each project for full license text.
