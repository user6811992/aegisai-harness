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

## Phase 2 batch 3/4 (completion)
| Source project | License | What was adapted |
|---|---|---|
| ix-infrastructure/Peer2Peer | Apache-2.0 | Encrypted agent messaging → `src/p2p_messaging.js` |
| tt-a1i/Archify | MIT | Interactive diagrams → `src/diagram_gen.js` |
| HarnessRouter/harnessrouter | Apache-2.0 | Unified harness protocol → `src/harness_protocol.js` |
| asg017/sqlite-rembed | MIT | Embedding client registry → `src/embedding_registry.js` |
| ikawrakow/ik_llama.cpp, mozilla-ai/llamafile, HyperMink/inferenceable | MIT/Apache-2.0 | Backend variants + ABI guard → `src/backend_variants.js` |
| StarTrail-org/LEANN | MIT | Compact vector index → `src/compact_index.js` |
| StarTrail-org/PixelRAG | Apache-2.0 | Visual retrieval → `src/visual_retrieval.js` |
| forge + jordandevai/IK-LLama-Proxy | MIT | Proxy guardrails → `src/proxy_guardrails.js` |
| alesha-pro/vllm-cross-model-kv | MIT | KV transfer contract → `src/kv_transfer.js` |

## Phase 3
| Source project | License | What was adapted |
|---|---|---|
| llama-server-launcher | MIT | Chat templates + config profiles → `src/chat_templates.js`, `src/config_profiles.js` |
| hardbyte/python-common-expression-language | Apache-2.0 | CEL policy rules → `src/cel_policy.js` |
| 0xNyk/agent-security | MIT | Deterministic security gates → `src/security_gates.js` |
| kdeps/kdeps | Apache-2.0 | Workflow-as-YAML → `src/workflow_yaml.js` |
| Panniantong/Agent-Reach | MIT | Social reach adapter → `src/social_reach.js` |
| LostRuins/lite.koboldai.net, koboldcpp | AGPL-3.0 | Clean-room UI/card patterns only (no source vendored) → `src/offline_webui.js`, `src/character_cards.js` |
| gabrielursan-beep/red-alert-llm | MIT | Offline knowledge pack → `src/knowledge_pack.js` |
| aws/strands-dynamodb-storage, aws/context-ontology-accelerator | Apache-2.0 | Storage/ontology contracts → `src/agent_storage.js`, `src/ontology_context.js` |
| alesha-pro/ai-orbiter | MIT | Universal MCP registry → `src/mcp_registry.js` |
| THU-MAIC/OpenMAIC | MIT | Classroom turn-taking → `src/classroom.js` |
| m-bain/whisperX | MIT | ASR pipeline contract (external toolchain, not bundled) → `src/asr_pipeline.js` |
| togg53192-cmd/recon | MIT | OSINT aggregator contract → `src/osint_aggregator.js` |
| nolly-studio/components-build-skill, obsidianmd/obsidian-skills, morluto/rea, hardbyte/obsidian-llm-plugin | MIT/Apache-2.0 | Clean-room skills (no source vendored) → `data/skills/` |

## Phase 4
| Source project | License | What was adapted |
|---|---|---|
| replikeit/ik-llama-cpp-rs | MIT | Native FFI binding contract → `src/native_bindings.js` |
| LostRuins/koboldcpp + stable-diffusion.cpp | AGPL-3.0 / MIT | Clean-room multi-modal + sd_cpp adapter patterns (no source vendored) |
| sergey-automation/parallel-gpu-weight-loading | MIT | Parallel shard placement → `src/parallel_loader.js` |
| adambenhassen/llama-swap-ik | MIT | ik_llama Docker profile → `packaging/docker/docker-compose.ik_llama.yml` |
| LostRuins/phishing-database | MIT | Phishing domain patterns → `src/phishing_filter.js` |
| mozilla-ai/llamafile + llamafile-builder | Apache-2.0 | Portable executable manifest → `src/portable_dist.js` |
| steadfastgaze/mlx-iqk, wepromen/pxq_llama, PhilAnderson1/minicpm-pi5 | MIT | MLX/low-bit quant heuristics → `src/backend_variants.js`, `src/quant_advisor.js` |
| ambassadorOfCplusPlus/memex-engine-public | MIT | MoE offload planner → `src/moe_engine.js` |
| HyperMink/inferenceable | Apache-2.0 | GBNF grammar constraints → `src/grammar_constraints.js` |
| 0xNyk/termpeek | MIT | Terminal preview → `src/terminal_preview.js` |
| aws/credential-daemon + aws/aws-emulator | Apache-2.0 | Credential sealing + emulator target contracts |
| hardbyte/paillier.js | MIT | Pure-JS Paillier (rewritten with BigInt) → `src/paillier.js` |
| collin80/symgrate2-ghidra-plugin, morluto/kuna, morluto/reef + verifiers | MIT | Ghidra/decompiler/RL contracts (clean-room) |

## Phase 5 + research scan 2026-11-27
| Source project | License | What was adapted / noted |
|---|---|---|
| eelbaz/mLattice, jit-lora, olmo3-miras, tensorbend-predictor, peerhive | MIT | Research contracts → `src/mlattice.js`, `jit_lora.js`, `miras_memory.js`, `expert_prefetch.js`, `peerhive.js` |
| DietrichGebert/ponytail | MIT | Shortcut debt ledger → `src/shortcut_debt.js` |
| steadfastgaze/mlx-iqk, MoEspresso, mlx-kquant | MIT | IQ_K codec correction in `src/backend_variants.js` |
| ikawrakow/ik_llama.cpp | MIT | MoE offload correction in `src/moe_engine.js`, `quant_advisor.js` |
| tleyden/tauri2-local-llm, janhq/jan | MIT/Apache-2.0 | Tauri FFI strategy correction in `src/native_bindings.js` |
| travisgoodspeed/symgrate2-ida-plugin, Ghidra BSim | MIT/Apache-2.0 | Thumb2 research note (roadmap) |
| BaaRai/ARTEX, aidenybai/react-scan | MIT | Optional research notes (roadmap) |

All third-party components retain their respective licenses. See each project for full license text.
