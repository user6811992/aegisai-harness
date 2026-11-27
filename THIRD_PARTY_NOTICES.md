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

## Clean-room adaptations (by source project)
Every module below was independently implemented from the **idea/feature set**
of the referenced project. No source code was copied. All are local-only and
opt-in where network or heavy toolchains are involved.

| Source project | License | What was adapted |
|---|---|---|
| antoinezambelli/forge | MIT | Tool-call reliability guardrails (rescue parsing, retry nudges, response validation) → `src/tool_guardrails.js` |
| thad0ctor/llama-server-launcher | MIT | HF streaming downloader → `src/hf_download.js` |
| pmaeria/tune-ik-llama | MIT | Local-inference tuning procedure → `src/inference_playbook.js` |
| aicodeking/leanrea | MIT | Zero-tool RE methodology → `src/leanrea_skill.js` |
| aicodeking/deepseek-stack | MIT | Reliability skill patterns → Aegis skill pack |
| alesha-pro/inference-optimization-playbook | public reference | Universal measured tuning methodology → `src/inference_playbook.js` |
| alesha-pro/claude-memory-bridge | MIT | Harness-agnostic memory-file idea → roadmap (planned) |
| linux-can/can-utils, collin80/SavvyCAN, cantools, hardbyte/python-can | various | CAN bus RE methodology → `src/canbus_skill.js` |
| ikawrakow/ik_llama.cpp | MIT | SOTA quant / MoE flag patterns → roadmap (planned) |
| mozilla-ai/llamafile, llamafile-builder | Apache-2.0 | Recipe builds, single-file distribution → roadmap (planned) |
| lightpanda-io/browser + agent-skill | Apache-2.0/MIT | Opt-in headless browser backend → `src/lightpanda.js` |
| StarTrail-org/LEANN | MIT | Compact RAG idea → roadmap (planned) |
| StarTrail-org/PixelRAG | Apache-2.0 | Visual retrieval idea → roadmap (planned) |
| Panniantong/Agent-Reach | MIT | Social/web reach patterns → roadmap (planned) |
| martossien/dashboard-llm | MIT | Prometheus metrics + config-hardening patterns → roadmap (planned) |
| hardbyte/qabot | MIT | NL→SQL local data queries → roadmap (planned) |
| hardbyte/paillier.js | MIT | Homomorphic encryption idea → roadmap (planned) |
| xerj-org/xerj | Apache-2.0 | BM25 + kNN + hybrid RRF search → `src/hybrid_search.js` |
| morluto/leantoken | MIT OR Apache-2.0 | Code intelligence / token-lean context → roadmap (planned) |
| morluto/rea | MIT | RE target catalog reference → roadmap (planned) |
| morluto/kuna | MIT | Agent-first decompiler idea → roadmap (planned) |
| kepano/defuddle | MIT | Main-content extraction → `src/content_extract.js` |
| kepano + obsidianmd/obsidian-skills | MIT | Vault/open formats → `src/obsidian_skill.js` |
| THU-MAIC/OpenMAIC | MIT | Multi-agent classroom patterns → roadmap (planned) |
| 0xNyk/lacp | MIT | Local control plane → `src/local_control.js` |
| 0xNyk/agent-security | MIT | Deterministic security gates → roadmap (planned) |
| 0xNyk/obsidian-curator | MIT | Knowledge-graph maintenance → `src/vault_curator.js` |
| 0xNyk/unmachined | MIT | Anti-slop scanner → `src/slop_scan.js` |
| 0xNyk/council-of-high-intelligence | MIT | Multi-perspective deliberation → roadmap (planned) |

## Phase 1 completion additions and ix-infrastructure
| Source project | License | What was adapted |
|---|---|---|
| Martossien/dashboard-llm | MIT | Config hardening (field whitelist, atomic writes, locking) → `src/safe_config.js` |
| mozilla-ai/llamafile-builder | Apache-2.0 | JSON model recipes → `src/model_recipes.js` |
| aicodeking/deepseek-stack | MIT | 9 cheap-model reliability loops → `src/reliability_skills.js` |
| alesha-pro/claude-memory-bridge | MIT | Harness-agnostic memory files → `src/memory_bridge.js` |
| 0xNyk/council-of-high-intelligence | MIT | Multi-perspective deliberation → `src/council.js` |
| Panniantong/skillshare | MIT | Multi-harness skill sync → `src/skill_sync.js` |
| replikeit/ik-llama-cpp-rs | MIT | Weekly submodule bump workflow pattern → `.github/workflows/submodule-bump.yml` |
| ix-infrastructure/Ix | Apache-2.0 | Persistent code graph / bounded structural retrieval → roadmap (planned) |
| ix-infrastructure/Peer2Peer | Apache-2.0 | E2E-encrypted agent P2P coordination → roadmap (planned) |

## Phase 2 additions and research scan
| Source project | License | What was adapted |
|---|---|---|
| raketenkater/ggrun | MIT | VRAM fit + launch dry-run → `src/model_fit.js` |
| ix-infrastructure/Ix | Apache-2.0 | Code system graph → `src/code_graph.js` |
| Martossien/dashboard-llm | MIT | Prometheus metrics exposition → `src/prometheus.js` |
| aicodeking/PandaOrchestrator | MIT | Cheapest-model router + escalation ladder → `src/escalation_router.js` |
| hardbyte/qabot | MIT | Offline NL→SQL → `src/data_query.js` |
| VectifyAI/PageIndex + ConDB | Apache-2.0 | Vectorless reasoning RAG → roadmap (planned) |
| VectifyAI/ChatIndex | Apache-2.0 | Tree-index for long conversations → roadmap (planned) |
| tt-a1i/archify | MIT | Interactive diagrams → roadmap (planned) |
| HarnessRouter/harnessrouter | Apache-2.0 | Unified Harness Protocol → roadmap (planned) |
| tt-a1i/hive | BSL-1.1 | Local multi-agent PTY teams → roadmap (planned) |

## Phase 2 batch 2
| Source project | License | What was adapted |
|---|---|---|
| VectifyAI/PageIndex + ConDB | Apache-2.0 | Reasoning tree index → `src/tree_index.js` |
| VectifyAI/ChatIndex | Apache-2.0 | Conversation tree → `src/tree_index.js` |
| VykosX/Llama-Optimizer | MIT | Backend sweeps → `src/backend_sweeps.js` |
| hardbyte/netchecks | MIT | Network condition assertions → `src/network_checks.js` |
| morluto/leantoken | MIT OR Apache-2.0 | Token-lean code selection → `src/code_intelligence.js` |

All third-party components retain their respective licenses. See each project for full license text.
