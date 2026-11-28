# Changelog

All notable changes to AegisAi Harness are documented here.

## [1.0.61] - 2026-11-28

### Fixed
- `tests/hardware_profile.test.js` used a hardcoded Windows source path and failed to load on Linux CI; now derives the path from `__dirname`.

### Verification
- 725 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.60] - 2026-11-28

### Added (hardware profiles)
- **`src/hardware_profile.js`** — portable, shareable hardware optimization profiles stored in `data/profiles/`. Strict field whitelist: unknown fields, unsafe flags and invalid values are dropped with warnings, so a shared file can never carry a command or script. Save/list/import/export/apply/set-active, plus `hardware_profile_*` MCP tools.
- **Startup loader** — `src/index.js` applies the active profile before backend detection; explicit user choice overrides saved settings.
- `GET/POST /api/hardware-profile` and a **Settings → Hardware** tab in the web UI (suggest-from-hardware, apply, delete, import).
- New `docs/HARDWARE_PROFILES.md` with the format and an AMD Vulkan example; README linked.
- New `tests/hardware_profile.test.js` (5 tests).

### Documentation / roadmap
- ROADMAP: added a **Research & future queue** (Kunlun K200, Windows driver/firmware RE, multi-model slots, CUDA validation, queued polish); marked historical re-evaluation snapshot; fixed malformed "New in" markers and the stale "All complete — v1.0.48" line.
- `docs/FUTURE_INTEGRATIONS.md` and `THIRD_PARTY_NOTICES.md` updated with recent backend/profile work and research-only references.

### Verification
- 725 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.59] - 2026-11-27

### Fixed
- Made the llama.cpp setup regression test platform-neutral; CI on Linux failed because it asserted a Windows `.exe` path.

### Verification
- 720 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.58] - 2026-11-27

### Added (llama.cpp packaging)
- `backend_setup` can now install llama.cpp from the official MIT-licensed prebuilt binaries in the latest `b*` release: Windows Vulkan (AMD-friendly) with CPU fallback, Linux Ubuntu Vulkan, macOS arm64/x64. No source is vendored or compiled locally; `llama-server.exe` lands in `data/backends/llama.cpp`.
- `POST /api/backend/setup` accepts `model` (GGUF path) and starts `llama-server --host 127.0.0.1 --port 8081 -m <model>`; the onboarding UI adds a GGUF path input for the `llamacpp` backend.
- `THIRD_PARTY_NOTICES.md` records the distributed llama.cpp binary and its MIT attribution.
- One new backend_setup test (7 total).

### Verification
- 720 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.57] - 2026-11-27

### Fixed
- Backend detection now checks known per-user install paths (e.g. `%LOCALAPPDATA%\Programs\Ollama\ollama.exe`) in addition to `PATH`, so a backend installed by winget is recognized even when the harness process started before the install. The start action uses the resolved binary path.

### Verification
- 719 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.56] - 2026-11-27

### Added (opt-in backend auto-setup)
- **`src/backend_setup.js`** — status/plan/ensure for local backends. Installs and starts Ollama via winget/Homebrew/official script; manual instructions for llama.cpp and LM Studio. Requires explicit confirmation; install blocked offline; no user-supplied commands are executed.
- `GET /api/backend/setup?type=…` (report only) and `POST /api/backend/setup` (`install`, `start`, `confirmed`) wired into the HTTP server and MCP tools.
- Web onboarding: shows "Install & start" for the selected backend and a link to manual instructions when no universal installer exists.
- New `tests/backend_setup.test.js` (6 tests).

### Fixed
- Connection failures now report the backend type and URL that was tried, plus the setup hint, instead of a bare `fetch failed`.
- `docs/TROUBLESHOOTING.md` and README document the new flow.

### Verification
- 719 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.55] - 2026-11-27

### Fixed (found during full installer smoke test)
- **Tauri bundles no longer nest resources under `_up_\_up_`.** `tauri.conf.json` now maps each source path to an explicit target (`../../src` → `src`, etc.) instead of letting `../..` escape the bundle root. New installers place `src/index.js` where the launcher expects it.
- **Backward compatibility:** `app_root()` in `packaging/tauri/src/lib.rs` now also checks the legacy `_up_\_up_` layout, so already-installed 1.0.54 apps can find their bundled resources.
- New `tests/tauri_packaging.test.js` (3 tests) guards the resource targets and legacy fallback.

### Verification
- 713 tests pass, 0 failures, 1 skipped. `cargo check --locked` clean. Version consistency ok.

## [1.0.54] - 2026-11-27

### Documentation & roadmap cleanup
- Removed vague "85 milestones" claims from README and wiki; replaced with accurate "Phases 1–5 complete (92/96 roadmap items)".
- README research table now distinguishes shipped local contracts from work that still needs an external toolchain or community protocol.
- Fixed stale "never bundled" / "Planned" claims for mLattice, JIT LoRA, MIRAS, expert prefetch, peerhive, Ed25519 signing and the dashboard panel.
- `THIRD_PARTY_NOTICES.md` research section now points to the actual bundled contract modules.
- Decision principle updated in `ROADMAP.md` and `docs/FUTURE_INTEGRATIONS.md`: contracts ship; external backends never bundle.
- Phase 6 rewritten with feasibility labels: interoperability and hardware profiles are feasible now; module marketplace and offline verification network need protocol research.
- Removed stale untracked `test_output.txt`; refreshed the duplicate re-evaluation block in `ROADMAP.md`.
- No open GitHub issues or PRs at this point.

### Verification
- 710 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.53] - 2026-11-27

### Fixed (reported issues)
- **#192** — `model_fit` now sums all `-NNNNN-of-NNNNN.gguf` shards in `readGgufMeta()` and `estimate()`, so split models no longer underreport VRAM/RAM. Exposes `shardFiles()` and `split: { index, total }`.
- **#193** — `workflow_yaml.parse()` now handles `on: [push, pull_request]` and `on: push` in addition to block form, and `run()` correctly gates unlisted events.
- New `tests/issues_192_193.test.js` (4 tests).

### Added
- **`src/hardware_probe.js`** — read-only local capability probe (`vulkaninfo --summary`, `nvidia-smi`) with `hardware_probe` / `hardware_recommend` MCP tools. New `tests/hardware_probe.test.js` (4 tests).

### Hardware validation status
- Vulkan AMD RX 5700 XT: present and probed (Vulkan 1.4.357, driver 26.11.2).
- CUDA GTX 1660 Super: GPU present, but NVML (`nvidia-smi`) fails and no CUDA toolkit is installed — CUDA flags remain unvalidated.
- MLX, Ghidra, and real Tauri FFI inference cannot be validated on this machine (no Apple Silicon/JDK/model binaries).

### Verification
- 710 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.52] - 2026-11-27

### Added (Phase 5 complete — 6/6)
- **mLattice** (`src/mlattice.js`) — 9-cell flat linear-memory encoding and recall (2 MCP tools)
- **JIT LoRA** (`src/jit_lora.js`) — ≥33% quality guard before applying continuous updates (2 MCP tools)
- **MIRAS/Titans memory** (`src/miras_memory.js`) — surprise-scored long-term writes (2 MCP tools)
- **Expert prefetch** (`src/expert_prefetch.js`) — router-history-based next-expert prediction (1 MCP tool)
- **Fixed-point detection** (`src/fixed_point.js`) — hash-based convergence for self-improvement loops (1 MCP tool)
- **peerhive** (`src/peerhive.js`) — opt-in p2p pubsub topic contract, offline-gated (3 MCP tools)
- **Shortcut debt ledger** (`src/shortcut_debt.js`) — read-only scan of deferred `shortcut:` comments
- New `tests/phase5.test.js` with 9 tests

### Fixed (research-verified corrections to Phase 4)
- `backend_variants.js`: MLX IQ_K codec set corrected to IQ1_S_R4 / IQ2_KS / IQ2_K (IQ3_K/IQ4_K belong to mlx-kquant).
- `moe_engine.js`: removed `-rtr` from CPU-offload flags (it forces CPU matmul for k-quants); added caveats about RAM/swap and smallest fitting offload.
- `quant_advisor.js`: warn that sub-Q4 MoE degrades faster and should only use imatrix-calibrated IQ_K files.
- `native_bindings.js`: recommend supervised worker process over in-process FFI, pin upstream commit/tag, feature-gate native compilation.
- `src/mcp_server.js`: restored merge safety — verified prefix maps do not collide.

### Documentation / research scan
- Account sweep: `DietrichGebert` (ponytail 200,020★), GitHub "rea" search pages 1–2 (mostly React noise; ARTEX and react-scan noted), hardware verification (mlx-iqk/MoEspresso, ik_llama offload, Tauri FFI, Ghidra BSim).
- ROADMAP: Phases 1–5 complete (92/96); Phase 6 remains (4 community items). New research-scan section added.
- `docs/FUTURE_INTEGRATIONS.md`, `THIRD_PARTY_NOTICES.md`, README acknowledgements updated.

### Verification
- 702 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.51] - 2026-11-27

### Added (Phase 4 complete — 19/19)
- **Native FFI contract** (`src/native_bindings.js`) — opt-in in-process Tauri/Rust inference bindings (2 MCP tools)
- **Multi-modal adapter** (`src/multimodal_tools.js`) — text/image/audio/video planning, offline-gated (2 MCP tools)
- **Parallel loader** (`src/parallel_loader.js`) — greedy GPU shard placement (1 MCP tool)
- **Phishing filter** (`src/phishing_filter.js`) — built-in domain blocklist (2 MCP tools)
- **Portable distribution** (`src/portable_dist.js`) — single-file executable manifest (1 MCP tool)
- **Quant advisor** (`src/quant_advisor.js`) — universal low-bit/MoE quant heuristic (1 MCP tool)
- **GBNF grammars** (`src/grammar_constraints.js`) — enum + JSON structured-output grammars (2 MCP tools)
- **Terminal preview** (`src/terminal_preview.js`) — text-only image/diff preview (1 MCP tool)
- **Credential seal** (`src/credential_seal.js`) — AES-GCM secret sealing contract (3 MCP tools)
- **AWS emulator target** (`src/aws_emulator_target.js`) — authorized local pentest target plan (1 MCP tool)
- **Paillier homomorphic encryption** (`src/paillier.js`) — pure-BigInt additively homomorphic crypto with Miller-Rabin (4 MCP tools)
- **Thumb2 symbols** (`src/thumb2_symbols.js`) — Ghidra recovery plan, external toolchain (2 MCP tools)
- **Decompiler bridge** (`src/decompiler_bridge.js`) — agent-first hypothesis scoring (2 MCP tools)
- **RL harness** (`src/rl_harness.js`) — tabletop env/step/eval loop (3 MCP tools)
- **MoE engine** (`src/moe_engine.js`) — expert offload planner for weak hardware (1 MCP tool)
- **Backend variants** (`src/backend_variants.js`) — added sd_cpp, mlx (IQ_K), memex adapters
- **ik_llama Docker profile** (`packaging/docker/docker-compose.ik_llama.yml`) — opt-in compose profile
- New `tests/phase4.test.js` with 17 tests

### Verification
- 693 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.50] - 2026-11-27

### Added (Phase 3 complete — 24/24)
- **Chat templates** (`src/chat_templates.js`) — Jinja-style variables, presets, reasoning/thinking controls (2 MCP tools)
- **CEL policies** (`src/cel_policy.js`) — safe non-Turing-complete expression evaluator (1 MCP tool)
- **Security gates** (`src/security_gates.js`) — deterministic URL/content/repo scanners; CLEAN means "no known pattern", not "safe" (2 MCP tools)
- **Workflow YAML** (`src/workflow_yaml.js`) — event listeners + step planner (2 MCP tools)
- **Config profiles** (`src/config_profiles.js`) — per-backend launch profiles, whitelisted import/export (2 MCP tools)
- **Social reach** (`src/social_reach.js`) — opt-in social/web adapter, disabled offline (1 MCP tool)
- **Ed25519 signing** (`src/ed25519_signing.js`) — detached signatures for verification certificates (3 MCP tools)
- **Offline web UI** (`src/offline_webui.js`) — single-file zero-dependency HTML (1 MCP tool)
- **Character cards** (`src/character_cards.js`) — Tavern cards, world info, author's notes (2 MCP tools)
- **AI Horde provider** (`src/horde_provider.js`) — opt-in distributed generation, disabled offline (2 MCP tools)
- **Model store** (`src/model_store.js`) — unified backend registry, opt-in pulls (3 MCP tools)
- **Knowledge packs** (`src/knowledge_pack.js`) — offline portable versioned bundles (3 MCP tools)
- **Agent storage** (`src/agent_storage.js`) — unified session/trace/memory contract (2 MCP tools)
- **Ontology context** (`src/ontology_context.js`) — typed entities/relations with graph traversal (3 MCP tools)
- **Universal MCP registry** (`src/mcp_registry.js`) — local installed-server registry merged with existing browser/install flow (4 MCP tools)
- **Classroom** (`src/classroom.js`) — multi-agent turn-taking + rubric grading (3 MCP tools)
- **ASR pipeline** (`src/asr_pipeline.js`) — word-level alignment/diarization contract with offline stub (2 MCP tools)
- **OSINT aggregator** (`src/osint_aggregator.js`) — opt-in multi-source plan only, disabled offline (2 MCP tools)
- **Lean 4 release gate** (`scripts/lean-gate.js`) — opt-in CI gate; skips when no Lean project is declared
- **4 new skills** — `vault-notes-chat`, `react-component-build` (16 rules), `open-formats-canvas`, `rea-mcp-reference`
- New test files: `phase3_batch1/2/3.test.js` (31 tests)

### Fixed
- `src/workflow_yaml.js` parser now starts a fresh step for every `- ` item (previously only captured the first step).
- Restored and merged `src/mcp_registry.js` (the universal registry was accidentally overwritten; the original registry browser/install flow is intact).

### Verification
- 676 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.49] - 2026-11-27

### Added (Phase 2 complete — 25/25)
- **P2P messaging** (`src/p2p_messaging.js`) — account-free RSA-OAEP + AES-GCM encrypted agent messaging, presence, conflict warnings (4 MCP tools)
- **Diagram generation** (`src/diagram_gen.js`) — 10 diagram types, single-file interactive HTML (1 MCP tool)
- **Unified Harness Protocol** (`src/harness_protocol.js`) — harness adapter registry + task/result envelopes (2 MCP tools)
- **Embedding registry** (`src/embedding_registry.js`) — 7 embedding clients with offline local default (3 MCP tools)
- **Backend variants** (`src/backend_variants.js`) — ik_llama/llamafile/vLLM adapters with ABI incompatibility guard (2 MCP tools)
- **Compact index** (`src/compact_index.js`) — LEANN-style metadata-only storage, on-demand embedding recompute (2 MCP tools)
- **Visual retrieval** (`src/visual_retrieval.js`) — screenshot descriptors + search (2 MCP tools)
- **Proxy guardrails** (`src/proxy_guardrails.js`) — transparent request/response reliability checks (1 MCP tool)
- **KV transfer** (`src/kv_transfer.js`) — cross-model KV mapping contract, fails closed (1 MCP tool)
- **Dashboard panel** (`src/admin_panel_metrics.js`) — self-contained HTML performance panel (1 MCP tool)
- New `tests/phase2_batch3.test.js` (11 tests) and `tests/phase2_batch4.test.js` (3 tests)

### Documentation
- ROADMAP: Phases 1 and 2 both complete (45/96 items); remaining phases 3–6 documented. Module count 343, tests 645 across all docs.

### Verification
- 645 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.48] - 2026-11-27

### Added (Phase 2 batch 2)
- **Reasoning tree index** (`src/tree_index.js`) — vectorless RAG from PageIndex/ConDB/ChatIndex: heading trees for documents, turn trees for conversations, reasoning-proxy search (4 MCP tools)
- **Network assertions** (`src/network_checks.js`) — declarative + live HTTP condition checks (2 MCP tools)
- **Backend sweeps** (`src/backend_sweeps.js`) — time-boxed speed/quality/cost scoring feeding metrics_store (1 MCP tool)
- **Token-lean code selection** (`src/code_intelligence.js`) — Leantoken-style relevant file selection (1 MCP tool)
- New `tests/phase2_batch2.test.js` with 10 tests

### Fixed
- Full staleness audit: updated version strings (1.0.44→1.0.48) across issue template, release workflow, wiki, admin UI; module counts to 334; README acknowledgements expanded with all recent sources.

### Verification
- 631 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.47] - 2026-11-27

### Added (Phase 2 — core inference, first batch)
- **VRAM fit + launch dry-run** (`src/model_fit.js`) — GGUF metadata, multi-GPU/RAM placement plan, launch command (2 MCP tools)
- **Ix-style code graph** (`src/code_graph.js`) — persistent symbols/imports graph, map/explain/trace/impact (4 MCP tools)
- **Prometheus metrics** (`src/prometheus.js`) — standard /metrics text exposition (1 MCP tool)
- **Offline NL→SQL** (`src/data_query.js`) — natural-language to SQL for local data, optional local execution (1 MCP tool)
- **Cheapest-model router** (`src/escalation_router.js`) — P(success)/cost/latency modes + escalation ladder (1 MCP tool)
- New `tests/phase2.test.js` with 14 tests

### Documentation
- ROADMAP: Phase 2 now 7/25 done; added 5 research items (PageIndex/ConDB vectorless RAG, ChatIndex tree-index, Archify diagrams, HarnessRouter UHP, Hive PTY teams). Re-evaluation: 27/96 implemented.
- `THIRD_PARTY_NOTICES.md`: Phase 2 additions and research scan matrix.

### Verification
- 621 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.46] - 2026-11-27

### Added (Phase 1 complete — 18/18)
- **Config hardening** (`src/safe_config.js`) — field whitelist, validation, atomic writes with backup + file locking (2 MCP tools)
- **Council of High Intelligence** (`src/council.js`) — multi-perspective deliberation with independent positions, forced disagreement, verdict preserving dissent/kill criteria (2 MCP tools)
- **Skill sync** (`src/skill_sync.js`) — one source of truth synced to Claude/Codex/OpenCode/Cursor/Copilot/Hermes skill dirs (2 MCP tools)
- **Shared memory bridge** (`src/memory_bridge.js`) — harness-agnostic live memory files, 25 KB/200-line index cap (4 MCP tools)
- **Model recipes** (`src/model_recipes.js`) — JSON recipes for reproducible builds, save/reuse/share (2 MCP tools)
- **DeepSeek reliability skills** (`src/reliability_skills.js`) — 9 cheap-model short-loop skills
- **Weekly submodule bump** — `.github/workflows/submodule-bump.yml` for vendor/aegis
- New `tests/phase1_finish.test.js` with 10 tests

### Documentation
- ROADMAP: Phase 1 now 18/18 complete; added ix-infrastructure findings (Ix graph 1,211⭐, Peer2Peer E2E agent P2P); re-evaluation updated to 21/91 implemented.
- `THIRD_PARTY_NOTICES.md`: added Phase 1 completion additions and ix-infrastructure matrix.

### Verification
- 607 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.45] - 2026-11-27

### Added (Phase 1/4 — curator + anti-slop)
- **Knowledge-graph curator** (`src/vault_curator.js`): clean-room 0xNyk/obsidian-curator (MIT). Dry-run-by-default vault maintenance — rename timestamp/category-shaped titles to claim-shaped, propose wikilinks between related notes, prune orphaned old notes (hub-aware, never flags MOC/index notes). 1 MCP tool: `vault_curator_report`.
- **Anti-slop scanner** (`src/slop_scan.js`): clean-room 0xNyk/unmachined (MIT). Deterministic prose/UI tells with severity-tiered findings, scoring with threshold (pass is a floor), and a bounded rewrite loop with stop gate. 3 MCP tools: `slop_scan_text`, `slop_scan_ui`, `slop_rewrite_loop`.
- New `tests/curator_slop.test.js` with 13 tests.

### Documentation & licensing audit
- Updated stale references: issue template (1.0.15→1.0.45), docs/wiki.html (v1.0.15→v1.0.45, 307→316 modules), public/admin.html (v1.0.12→v1.0.45), README (307→316 modules, 320+→316).
- `THIRD_PARTY_NOTICES.md`: added a full clean-room adaptation matrix (~35 source projects with licenses and what was adapted).
- ROADMAP: corrected checkbox state for all implemented items (13/89), replaced hand-edited re-evaluation table with generated counts, added a comprehensive re-evaluation section covering all phases and future/research items.

### Verification
- 597 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.44] - 2026-11-27

### Added (Phase 1/3 — control plane + content extraction)
- **Local control plane** (`src/local_control.js`): clean-room adaptation of 0xNyk/lacp (MIT). Deterministic risk tiers (read/write/destructive/external), approval gates, evidence-based write checks, local-first policy (remote opt-in), execution records via the ledger, and rollback snapshots. Named `local_control.js` to coexist with the existing v0.33 `control_plane.js`. 4 MCP tools: `local_control_policy`, `local_control_gate`, `local_control_record`, `local_control_list`.
- **Content extraction** (`src/content_extract.js`): clean-room Defuddle-style (kepano/defuddle, 10,211⭐) main-content extraction — removes nav/header/footer/aside/scripts, prefers `<main>`/`<article>`, extracts title/description/author + schema.org JSON-LD, outputs readable text/Markdown. 2 MCP tools: `content_extract`, `content_extract_file`.
- New `tests/control_extract.test.js` with 16 tests.

### Fixed
- Restored `src/control_plane.js` (v0.33 govern/checkpoint/resume module) after it was accidentally overwritten during this work — full suite green again.

### Verification
- 584 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.43] - 2026-11-27

### Added (Phase 1 — Obsidian vault + open formats)
- **Obsidian skill** (`src/obsidian_skill.js`): clean-room adaptation of obsidianmd/obsidian-skills (54,260⭐) + kepano vault ideas. Local Markdown vaults, YAML frontmatter (subset parser/serializer), `[[wiki links]]` + backlinks, JSON Canvas (open infinite-canvas format), Bases view definitions, vault scanning, and note→KB extraction. Bundled as default skill `obsidian-vault`.
- 5 new MCP tools: `obsidian_skill`, `vault_scan`, `vault_note_info`, `vault_backlinks`, `canvas_info`.
- New `tests/obsidian_skill.test.js` with 12 tests.

### Documentation
- ROADMAP.md: added 6 items from 0xNyk (note: different from the earlier 404 `oxnyk`) — knowledge-graph curator, council of high intelligence, LACP control plane, deterministic agent-security gates, anti-slop scanner, terminal media preview. Re-evaluation updated: 90 total items (9 done, 81 remaining). Fixed malformed "New in" lines and a leftover description on the completed Obsidian item.
- `docs/FUTURE_INTEGRATIONS.md`: new section 6h.

### Verification
- 568 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.42] - 2026-11-27

### Added (Phase 2 — XERJ-style hybrid search)
- **Hybrid search engine** (`src/hybrid_search.js`): clean-room implementation of xerj-org/xerj (Apache-2.0) ideas. Zero dependencies, fully local. BM25 lexical scoring, feature-hash dense kNN, and reciprocal-rank fusion (RRF) for hybrid retrieval. Indexes markdown/txt/js/ts/json/jsonl/csv/log/yaml from a local directory (JSONL line-by-line, others in ~2KB passages). Returns top-k passages only — fewer output tokens. 2 new MCP tools: `hybrid_index_build`, `hybrid_search` (modes bm25/knn/hybrid).
- New `tests/hybrid_search.test.js` with 12 tests.

### Verification
- 556 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.41] - 2026-11-27

### Documentation
- ROADMAP.md: added 8 items from kepano/obsidianmd/THU-MAIC/kelseyhightower/xerj-org/oxnyk scans — Obsidian vault skills, Defuddle extraction, XERJ unified search/MCP, multi-agent classroom, JSON Canvas, minimalism/learn-by-doing references. Re-evaluation updated: 85 total items (7 done, 78 remaining). `oxnyk` returned 404 (user not found).
- `docs/FUTURE_INTEGRATIONS.md`: new section 6g with the detail matrix.

### Verification
- 544 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.40] - 2026-11-27

### Added (Phase 1 — universal inference optimization playbook)
- **Inference playbook skill** (`src/inference_playbook.js`): clean-room adaptation of alesha-pro's tested-hypotheses methodology. Deliberately **hardware-agnostic** — a measurement loop (baseline → one hypothesis → one variable → re-measure → keep/revert with provenance) that works on CPU-only, single/multi-GPU, Apple Silicon, AMD, NVIDIA, and DGX-class machines. Hypothesis catalog across placement/quantization/decoding/context/system with applicability tags; hardware examples are illustrative, never defaults. Bundled as default skill `tune-local-inference`.
- 3 new MCP tools: `tune_playbook_skill`, `tune_playbook_hypotheses`, `tune_playbook_record`.
- New `tests/inference_playbook.test.js` with 11 tests.

### Verification
- 544 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.39] - 2026-11-27

### Documentation
- ROADMAP.md: added 10 items from alesha-pro/nolly-studio/m-bain/togg53192-cmd scans — inference optimization playbook skill, shared memory-file bridge, cross-model KV cache transfer, word-level ASR+diarization (whisperX 25,794⭐), OSINT aggregator skill, React component build skill, universal MCP registry tool. Re-evaluation updated: 79 total items (6 done, 73 remaining).
- Fixed malformed "- **New in v1.0.NN:**" lines in ROADMAP.md (missing closing bold) from earlier bump scripts.
- `docs/FUTURE_INTEGRATIONS.md`: new section 6f with the detail matrix and hardware note.

### Verification
- 533 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.38] - 2026-11-27

### Added (Phase 1 — Lightpanda browser backend)
- **Lightpanda backend** (`src/lightpanda.js`): clean-room integration of lightpanda-io/browser (42,657⭐) + agent-skill (121⭐). Opt-in, NOT bundled — requires a separately installed `lightpanda` binary. Binary detection/version, CDP server start/stop, CLI one-shot fetch, and PandaScript deterministic replay scripts (save/list/run, token-free). Reuses the existing CDP browser integration by pointing `CDP_URL` at Lightpanda's endpoint (default port 9223). Bundled as default skill `lightpanda`.
- 6 new MCP tools: `lightpanda_available`, `lightpanda_start`, `lightpanda_fetch`, `lightpanda_script_save`, `lightpanda_script_list`, `lightpanda_skill` (network tools disabled in offline mode).
- New `tests/lightpanda.test.js` with 10 tests.

### Verification
- 533 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.37] - 2026-11-27

### Documentation
- ROADMAP.md: added 6 items from cantools/commai/morluto/lightpanda-io scans — Lightpanda browser backend (42,657⭐), LeanToken code intelligence (180⭐, 20–37% fewer tokens), REA full MCP reference (480,754⭐), Kuna agent-first decompiler, RL/eval harness. `commai` had zero public repos.
- Re-evaluation updated: 72 total items (5 done, 67 remaining).
- `docs/FUTURE_INTEGRATIONS.md`: new section 6e with the detail matrix.

### Verification
- 523 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.36] - 2026-11-27

### Added (Phase 1 — CAN bus RE skill)
- **CAN bus RE skill** (`src/canbus_skill.js`): clean-room adaptation of ideas from linux-can/can-utils, collin80/SavvyCAN, cantools, and hardbyte/python-can. Zero new tools — teaches the agent which real CLI tools to run for automotive/CAN work (candump, cansend, cantools, isotpsend/recv, SavvyCAN log formats, UDS/OBD-II). Fast commands by task (sniff/decode/inject/logformats/interfaces/isotp/uds/gmlan), safety-first traps, task detection, and command/interface availability checks.
- Bundled as default skill `canbus-re`; installable as `SKILL.md`; 2 MCP tools: `canbus_recon`, `canbus_skill`.
- New `tests/canbus_skill.test.js` with 10 tests.

### Verification
- 523 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.35] - 2026-11-27

### Documentation
- ROADMAP.md: added 10 items from linux-can/collin80/hardbyte/cantools scans — CAN bus RE skill (zero-tool leanrea-style), NL→SQL local data queries (qabot), network condition assertions (netchecks), vault/notes LLM integration (obsidian-llm-plugin), CEL policy expressions, homomorphic encryption (paillier.js), Ghidra Thumb2 symbol recovery. Note added about local hardware (Ryzen 5 5600X, 32 GB, RX 5700 XT 8 GB + GTX 1660 Super 6 GB) for running RE/inference workloads locally.
- Re-evaluation updated: 67 total items (4 done, 63 remaining).
- `docs/FUTURE_INTEGRATIONS.md`: new section 6d with the full detail matrix.

### Verification
- 513 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.34] - 2026-11-27

### Added (Phase 1 — lean-rea skill)
- **Lean REA skill** (`src/leanrea_skill.js`): clean-room adaptation of aicodeking/leanrea (8 KB SKILL.md idea). Zero new tools — teaches the agent which real CLI tools to run directly (asar, otool, nm, go version -m, jadx, apktool, Ghidra, tshark, binwalk, sqlite3) instead of a 207-tool MCP layer. Fast recon commands by target type (electron/macho/go/pe/apk/elf/archive/network), known traps, target detection, and installed-tool detection.
- Bundled as a default skill (`lean-rea`) in `default_skills.js`; installable as `SKILL.md` via `leanrea.install()`.
- 2 new MCP tools: `leanrea_recon`, `leanrea_skill`.
- New `tests/leanrea_skill.test.js` with 10 tests.

### Verification
- 513 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.33] - 2026-11-27

### Documentation
- ROADMAP.md: added 12 items from startrail-org, aicodeking, panniantong, and aws scans: leanrea skill (4,508⭐), deepseek-stack reliability skills, skillshare sync, LEANN compact RAG (13,839⭐), PandaOrchestrator cheapest-model router, PixelRAG visual retrieval (11,144⭐), Agent-Reach social/web adapter (115,269⭐), unified agent storage contract, ontology-backed context, hardware-backed credential vault, AWS local emulator, DevOps agent tools.
- Re-evaluation updated: 60 total items (3 done, 57 remaining).
- `docs/FUTURE_INTEGRATIONS.md`: new section 6c with the full detail matrix and license notes.

### Verification
- 503 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.32] - 2026-11-27

### Added (Phase 1 — tool-call reliability guardrails)
- **Tool-call guardrails** (`src/tool_guardrails.js`): clean-room adaptation of forge ideas (MIT). Rescue parsing repairs malformed tool calls (code fences, wrapped JSON, truncated JSON, key=value fallback); response validation detects empty/placeholder output; retry nudges inject corrective messages after failed tool results; optional workflow constraints (`required_steps`, `prerequisites`). `guardToolCall` enforces allowed/denied tool lists.
- Integrated into `runAgent` via opt-in `toolGuardrails` option: rescued calls emit `tool_guard` events, blocked calls are handled safely, failed results produce `tool_guard_nudge` events.
- 3 new MCP tools: `tool_guard_rescue`, `tool_guard_validate`, `tool_guard_workflow`.
- New `tests/tool_guardrails.test.js` with 16 tests.

### Verification
- 503 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.31] - 2026-11-27

### Documentation
- ROADMAP.md: added findings from llamafile pages 1–2 and ik_llama.cpp pages 3–4 scan to the phased backlog. 14 new items across Phases 1–4: tool-call reliability guardrails (forge, 2,271⭐), recipe-based model configs (llamafile-builder), llamafile backend variant (26,733⭐), Node.js inference server + GBNF grammars (inferenceable), SQLite embedding registration (sqlite-rembed), OpenAI-compat proxy guardrails (IK-LLama-Proxy), workflow-as-YAML (kdeps), offline knowledge pack (red-alert-llm), MLX IQ_K codecs, low-bit MoE quants, memex-engine, GBNF generation.
- Added a **Re-evaluation** table to the roadmap: 48 total items (2 done, 46 remaining); tool-call guardrails promoted to Phase 1 priority.
- `docs/FUTURE_INTEGRATIONS.md`: new section 6b cataloging the new repos with stars, ideas, phases, and license notes.

### Verification
- 487 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.30] - 2026-11-27

### Added (Phase 1 — HF model downloader)
- **Hugging Face downloader** (`src/hf_download.js`): clean-room implementation of thad0ctor/llama-server-launcher's HF downloader idea. Streams model files to local cache with progress callbacks, optional SHA-256 verification, redirect following, element-validation for repo ids/filenames (no traversal), path-root containment, and `.part` temp files with cleanup on failure. Respects `AEGISAI_OFFLINE` (all network tools disabled). Repo manifest listing via HF API.
- `model_discovery.huggingFacePull()` upgraded from a stub to a validated URL resolver (backward-compatible synchronous `.url`); new `hfDownload` / `hfManifest` exports for real streaming operations.
- 3 new MCP tools: `hf_model_url`, `hf_model_manifest`, `hf_model_download` (network tools only registered when not offline).
- New `tests/hf_download.test.js` with 11 tests.

### Verification
- 487 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.29] - 2026-11-27

### Added (Phase 1 — dataset tools)
- **Dataset curation module** (`src/dataset.js`): clean-room implementation of datasetexplorer ideas (AGPL-3.0 upstream — no code copied). Supports JSON/JSONL streaming load with element ranges, Alpaca/ShareGPT/Text/generic format detection and text extraction, composite filters (chars/words/turns/matches + regex/substring search + sort), n-gram analysis, exact + normalized dedup, merge/replace/subtract, select/erase, deterministic shuffle, regex/substring find/replace with dry-run, field replacement, JSON/JSONL export, and stats.
- 7 new MCP tools: `dataset_stats`, `dataset_filter`, `dataset_ngram`, `dataset_dedupe`, `dataset_merge`, `dataset_replace`, `dataset_export`.
- New `tests/dataset.test.js` with 28 tests and `docs/DATASET_TOOLS.md`.
- `THIRD_PARTY_NOTICES.md` documents the clean-room/AGPL attribution.

### Verification
- 476 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.28] - 2026-11-27

### Fixed (issues #190, #191)
- **#190** — freshly issued verification certificates failed their own content-hash check. `issue()` now hashes the certificate as saved (id included); `verify()` excludes only the self-referential `contentHash` field when recomputing. Added regression tests for self-verification and tamper detection.
- **#191** — `npm test` failed on source installs without git submodules initialized. The Aegis-skill file assertion is now conditional on `aegisSkills.aegisAvailable()`. README quick start now documents `git submodule update --init --recursive` for source installs.
- New `tests/v1028_fixes.test.js` with 3 regression tests.

### Verification
- 448 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.27] - 2026-11-27

### Documentation
- ROADMAP.md: replaced ad-hoc "Future / Planned Integrations" with a **Phased Integration Backlog** — 6 phases ordered by value ÷ effort (quick wins → core inference → product/UX → heavy/native → research-grade → community). Incorporates everything from the LostRuins (koboldcpp, datasetexplorer, lite.koboldai, stable-ui, stable-diffusion.cpp, cuda-toolkit) and ik_llama.cpp ecosystem (ik_llama.cpp, ggrun, llama-server-launcher, tune-ik-llama, Llama-Optimizer, ik-llama-cpp-rs, dashboard-llm) scans, plus all cross-cutting ideas.
- New detail matrix in `docs/FUTURE_INTEGRATIONS.md` organized by phase with sources, current state, remaining work, effort/impact, patterns worth reusing, and 8 decision principles.
- Priority keys (E/M/H) and explicit "planned, not committed" status added.

### Verification
- 445 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.26] - 2026-11-27

### Fixed
- ROADMAP footer "Current version" was stale (v1.0.24 while the header said v1.0.25). Both declarations are now consistent at v1.0.26.
- `scripts/check-version-consistency.js` now validates **all** "Current version" declarations in ROADMAP.md (previously only the first was checked), so a stale footer can no longer slip through CI.
- Added regression test in `tests/v068.test.js` asserting every ROADMAP version declaration matches `package.json`.

### Verification
- 445 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.25] - 2026-11-27

### Documentation
- ROADMAP.md: added a comprehensive "Future / Planned Integrations" section covering research-grade items (mLattice, JIT LoRA, MIRAS, MoE expert prefetch, peerhive, loop-dynamics editing) and feasible product enhancements (broader model bridging, Ed25519 certificate signing, Lean release gate, dashboard Web UI panel). All items explicitly marked planned, not committed.
- New `docs/FUTURE_INTEGRATIONS.md`: full detail matrix with sources, current state, remaining work, feasibility/impact ratings, cross-project patterns, and decision principles (local-only by default, opt-in heavy tools, provenance, measured-not-claimed, evidence-gated completion).
- README.md: expanded feature list (Performance Dashboard 2.0, hardware auto-tuning, unified model registry, verification certificates, optional research modules, convergence detection); new "Future & Research Integrations" table; expanded acknowledgments crediting eelbaz, harnessforge, apiad/aegis, and GanyuanRan/Aegis.
- Updated Layout section and module count.

### Verification
- 444 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.24] - 2026-11-27

### Added (cross-cutting + research)
- **Performance Dashboard 2.0** (`src/performance_dashboard.js`): unified local view merging model runs (token dashboard), tool timings (profiler), and HTTP phase timings (DNS/TCP/TLS/server/transfer) from `src/metrics_store.js`. New `performance_dashboard` MCP tool. HTTP tools now record metrics automatically.
- **Hardware auto-tuning** (`src/hardware_autotune.js`): derives concrete backend/quantization/context settings from the detected profile, with opt-in apply to `data/autotune.json`. New `--autotune` CLI flag and `hardware_autotune` MCP tool.
- **Unified model registry** (`src/model_registry.js`): aggregates discovery across all local providers, deduplicates bridged copies and split shards, and surfaces a single catalog via `model_registry_catalog`.
- **Optional research modules** (`src/optional_modules.js`): generalized lazy discovery of opt-in research modules (Lean, mLattice, JIT LoRA, MoE predictor, Aegis submodule) with clear availability status. New `optional_modules_status` MCP tool.
- **Verification certificates** (`src/verification_cert.js`): signed, hash-verifiable completion certificates built on evidence bundles + verifier (+ optional Lean check). New `certificate_issue` / `certificate_verify` MCP tools.
- **Convergence detection** (`src/convergence.js`): Banach-style fixed-point detection for the self-improvement loop (pure-JS policy layer).
- **Surprise-weighted memory policy** (`src/memory_policy.js`): MIRAS-inspired surprise scoring for consolidation plus the JIT-LORA ≥33% regularization guard against catastrophic forgetting.
- New `tests/crosscutting.test.js` with 23 tests.

### Documentation
- README, ROADMAP, CONTRIBUTING, docs pages updated to 444 tests.
- THIRD_PARTY_NOTICES.md updated with mLattice, JIT LoRA, and tensorbend-predictor attribution.

### Verification
- 444 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.23] - 2026-11-27

### Added (eelbaz integrations)
- **Model-store bridge** (`src/model_bridge.js`): detect Ollama and LM Studio model stores and symlink Ollama blobs into LM Studio's models directory. New `--sync-models` CLI flag (with `--dry-run`) and MCP tools `model_bridge_status` / `model_bridge_sync`. Inspired by `eelbaz/ollama-lmstudio-bridge`.
- **Phased HTTP timings** (`src/http_advanced.js`): DNS/TCP/TLS/server/transfer phase metrics, CDN detection from response headers, and a lightweight virtual-user load test. Re-exported from `http_probe.js`; MCP tools `http_probe_timing`, `http_detect_cdn`, `http_load_test`. Network tools are disabled in offline mode. Inspired by `eelbaz/lyra` and `eelbaz/cdnshare`.
- **Hardware profiles** (`src/hardware.js`): named profiles for DGX Spark GB10 (`vllm`, NVFP4/BF16, 131K context), Blackwell, Apple Silicon (MLX), and generic CUDA. `hardware_detect` MCP tool. See `docs/DGX_SPARK.md`. Inspired by `eelbaz/dgx-spark-vllm-setup`.
- **InfluxDB line-protocol export** (`src/influxdb.js`): opt-in metric export to file or HTTP with proper escaping, span and load-test converters, and `metrics_export_influx` MCP tool. Local-only by default. Inspired by `eelbaz/lyra`.
- **Lean 4 verification** (`src/lean_verify.js`): optional formal-verification wrapper with graceful availability detection; `lean_verify_status` / `lean_verify_project` MCP tools. See `docs/LEAN_VERIFY.md`. Inspired by `eelbaz/Rule30PrizeKit`.
- New `tests/eelbaz_integrations.test.js` with 22 tests.

### Documentation
- README, ROADMAP, CONTRIBUTING, docs pages updated to 421 tests.
- `THIRD_PARTY_NOTICES.md` updated with eelbaz project attribution.

### Verification
- 421 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.22] - 2026-11-27

### Fixed
- Tauri release build: restored the pinned `dyn-clone = 1.0.20` dependency in `packaging/tauri/Cargo.lock` so the Windows MSI/NSIS bundles build in CI again.

### Verification
- 399 tests pass, 0 failures, 1 skipped. Version consistency ok. `cargo check --locked` clean.

## [1.0.21] - 2026-11-27

### Documentation & Licensing
- Refreshed all user-facing docs for v1.0.21: README, ROADMAP, CONTRIBUTING, llms.txt, docs landing page, wiki, and troubleshooting guide now reflect 399 tests and the latest feature set.
- README gains an `aegisai --init` scaffolding walkthrough and updated feature list (governance, project blueprints, native desktop shell, group coordination).
- CHANGELOG restructured: v1.0.20 and v1.0.19 entries now accurately document their respective releases.
- `THIRD_PARTY_NOTICES.md` expanded with attribution for the bundled Aegis method pack (vendor/aegis, MIT) and adapted patterns from harnessforge (project blueprints), apiad/aegis (group/broadcast IPC), and linkdigest-mcp (MCP preset).

### Verification
- 399 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.20] - 2026-11-27

### Added
- **Harnessforge-style blueprints** (`src/project_init.js`): `aegisai --init` now generates `SOUL.md` (system architecture overview), `TOOLS.md` (64+ tool catalog with security guidelines), `MEMORY.md` (memory hierarchy & Aegis integration), `PATH_RULES.md` (forbidden-path security protections), and `MCP_RECOMMENDATIONS.json` (per-project-type MCP server recommendations). Inspired by `jcaiagent7143-ui/harnessforge`.
- **Tauri group/broadcast IPC** (`packaging/tauri/src/lib.rs`): new commands `backend_broadcast(objective, output_format, tool_guidance, boundaries)`, `backend_group_spawn(profiles)`, and `backend_group_status()` plus five system-tray menu items for parallel multi-agent coordination (adapted from `apiad/aegis` group patterns). Frontend events: `group-broadcast`, `group-spawn`, `group-status`.
- **Comprehension benchmarks** (`tests/comprehension.test.js`): 18 new tests covering project-type detection, test commands, governance patterns (baseline/evidence/drift/verification gate), and MCP recommendations.
- Tauri tray menu gains a "Governance Status" item that emits a `governance-status` event to the WebView.

### Fixed
- CI: version strings now consistent at v1.0.20 across all 15+ files (`installer.iss`, `README.md`, `llms.txt`, `tauri.conf.json`, `Cargo.toml`, etc.).
- CI: escaped backticks in `src/project_init.js` template literals that caused a JS `SyntaxError` and broke four tests.
- CI: Tauri v2 `AppHandle.emit_to()` now imports the `tauri::Emitter` trait; `backend_group_spawn()` receives a `String`.

### Verification
- 399 tests pass, 0 failures, 1 skipped. All 9 CI checks green. npm published 1.0.20. GitHub release includes 4 installer bundles.

## [1.0.19] - 2026-11-27

### Added
- Governance module (src/governance.js): baseline-first, evidence-verified, drift-checked patterns from GanyuanRan/Aegis. Verification gate runs before claiming task completion.
- Project init command (`aegisai --init`): auto-generates AGENTS.md, .mcp.json, .aegisai/project.json for any project type (Node, Python, Rust, Go, Java, .NET, generic).
- Aegis skill pack bundled as git submodule (vendor/aegis): 22 high-value skills (first-principles-review, verification-before-completion, systematic-debugging, etc.) now available as bundled defaults.
- linkdigest-mcp registered as MCP preset for social media content extraction.
- Governance status included in agent run results.

### Changed
- Agent loop (src/agent/run.js) now records governance evidence for tool executions and runs verification gate before returning final response.
- default_skills.js now includes 21 Aegis skills as bundled defaults (383 tests at the time).
- mcp_presets.js adds linkdigest preset.

### Verification
- 383 tests pass, 0 failures, 1 skipped. Version consistency ok.

## [1.0.18] - 2026-11-27

### Fixed
- Fixed the v1.0.17 Tauri config (removed invalid NSIS `artifactName`) and Rust compile errors: command macros are now non-public, tray icon uses the configured app icon, and `spawn_backend` receives `AppHandle`. `cargo check` now passes cleanly.
- Issue #189: Performance Dashboard reported zero tokens for llama.cpp and zero built-in tool calls. OpenAI-compatible streaming requests now set `stream_options: { include_usage: true }`; `profiler.recordTool` is now called for every tool (built-in, coding, and cached). Added `tests/v1018_fixes.test.js` regression coverage.

### Verification
- 361 tests pass, 0 failures. `cargo check` exit code 0. Version consistency ok.

## [1.0.17] - 2026-11-27

### Added
- **Native Windows desktop shell (Tauri v2)**: `packaging/tauri/` now builds real MSI/NSIS installers. The Rust shell manages the Node backend (start/stop/restart), provides a system tray (show, restart backend, quit), and exposes IPC commands (`backend_status`, `backend_start`, `backend_stop`, `backend_restart`) to the localhost-origin WebView.
- Bundled harness resources (`src`, `public`, `scripts`, docs, LICENSE) into the Tauri installers; added Windows icons (`.ico`), capability permissions, and a Tauri README.
- Release workflow now builds Tauri bundles on `windows-latest` and attaches them to the GitHub release.

## [1.0.16] - 2026-11-26

### Security
- Fixed PowerShell command injection in `src/native_adapters.js` `windowsRPA.click()` by passing selector data as base64-encoded JSON instead of interpolating raw strings.
- Fixed SQL injection via column names in `src/backup.js` backup import by validating columns against `PRAGMA table_info`.
- Added tenant/session identifier validation in `src/tenants.js` to prevent path traversal.
- Fixed double-response bug on invalid tags in `src/index.js` (return inside forEach callback).
- Switched Docker/Compose web binding to `0.0.0.0` inside the container so published ports are reachable; bound Ollama to loopback only.
- Removed the GitHub PAT from the local git remote URL.

### Fixed
- Fixed `r is not defined` in `src/tenants.js` `checkQuota()` (all tenant tool-access checks previously threw).
- Fixed non-streaming OpenAI-compatible backend responses being parsed as SSE (silently empty content in compaction, memory, critic, peer review).
- Fixed `v052` test failure: `data` used before declaration in `src/agent/run.js`; also corrected token-count operator precedence.
- Fixed denied tool results missing `tool_call_id`, which broke follow-up model turns after approval denial.
- Fixed resource broker leases not being restored from disk; `isLocked()` now ignores expired locks.
- Fixed persistent shell `exec()` returning partial output after a fixed 200ms; now uses a completion sentinel with timeout fallback.
- Fixed REPL `/export` always exporting an empty conversation (dead code in `src/index.js`).
- Fixed agent compaction dropping removed messages from the archive.
- Fixed code sandbox temp-file collisions by using `mkdtempSync`; `isAvailable()` now reflects real runnable state.
- Added missing `src/harness_generator.js`, `harness_spec_schema.yaml`, `harness_spec_template.yaml` referenced by the roadmap (generator also had missing `fs`/`path` requires).

### Documentation & Packaging
- Corrected mojibake and stale version/test-count data across README, ROADMAP, CHANGELOG, docs pages, and issue templates.
- Balanced unmatched Markdown code fences in README, CHANGELOG, llms.txt, and CONTRIBUTING.
- Added `THIRD_PARTY_NOTICES.md`; shipped LICENSE + notices + `scripts/` in Windows/Linux/macOS installers (first-run `npm install` was broken without `scripts/`).
- Added Tauri `build.rs`, fixed Tauri versions/icons, added `.dockerignore`, Docker healthcheck and non-root user.
- Hardened CI: env-var indirection in release workflow (script injection), unconditional tag/version checks in npm and Docker workflows, version checker now covers Tauri files and semver prereleases.

### Issues resolved
- Issue #187 (v1.0.14 chat TDZ crash) — fixed in commit c35497b; regression test added via PR #188.

### Verification
- All 359 tests pass (358 pass, 1 skipped, 0 failures), including PR #188 regression test for issue #187.
- Version consistency check passes for v1.0.16.

## [1.0.15] - 2026-11-26

### Fixed
- Removed stray UTF-16 test output artifacts (test_final.txt, test_run.txt, testrun*.txt) from git tracking; added ignore rules so local test logs are never committed again.
- Cleaned literal mojibake text from the v1.0.14 CHANGELOG entry.

## [1.0.14] - 2026-11-26

### Fixed
- Corrected mojibake/encoding corruption in ROADMAP.md and README.md (em dashes rendered as corrupted character sequences).
- Updated stale documentation: README test count (257 -> 358), shipped-version range, and "Remaining / blocked" section now reflects all items complete.

## [1.0.13] - 2026-11-26

### Fixed
- Restored test compatibility in `src/persistent_shell.js`: `start()` now defaults the session ID to `'default'` so `ps.start()` / `ps.isRunning()` work when no session ID is supplied (commit 883113d).
- Stopped tracking runtime state (`.aegisai/a2a-broker/state.json`); added `.aegisai/` to `.gitignore` so runtime/session state is never committed.

## [1.0.12] - 2026-11-26

### Fixed
- Issue #184: v1.0.11 does not include fix commit; 10 issues still reproduce in fresh install.
- Resolved: version tag mismatch; all validations from v1.0.11 now present on main.

## [1.0.11] - 2026-11-26

### Added
- Tor/proxy support for web requests via AEGISAI_TOR_PROXY/TOR_PROXY (curl-backed, SOCKS/HTTP).
- Persistent shell session module (src/persistent_shell.js) for stateful command execution.

## [1.0.8] - 2026-11-26

### Added
- Search engines: Startpage and Firecrawl support added to web_search/multi_search.

## [1.0.7] - 2026-11-26

### Added
- Web search: pluggable engines (DuckDuckGo, Brave, Searx) selectable via AEGISAI_SEARCH_ENGINE or env keys; multi_search includes configured engines.

## [1.0.6] - 2026-11-26

### Fixed
- Chat: deterministic commands respond as SSE when stream:true; backend alias normalization and validation.

## [1.0.5] - 2026-11-26

### Fixed
- Backend: normalize aliases (llama.cpp, llama-cpp, etc.) in chat commands, /api/backend, and /api/config; validate supported types.

## [1.0.4] - 2026-11-26

### Fixed
- Chat: strip chat-template special tokens from streamed and final replies; buffer partial tokens across chunks.

## [1.0.3] - 2026-11-26

### Added
- Model discovery: detect and group split GGUF shards into a single model entry.

## [1.0.2] - 2026-11-26

### Fixed
- Web UI: restored stylesheet link and theme selectors; removed duplicate Performance Dashboard; conversation search highlighting; context meter and export use current session; default session history no longer reused silently.
- Agent: `get_time` and structured tools return previews with `ok`; small-talk/identity guards prevent spurious tool calls; web chat deterministic backend/model commands and system prompt.
- Backends: OpenAI-compatible backends now receive tool definitions; backend type switch uses default URLs and persists; `/api/config` activates the selected backend.
- Markdown: placeholder restore uses exact nonces; inline code in table cells renders; math with pipes stays in one cell.
- Scheduled tasks: cron evaluation honors day/month/weekday and scans 5 years for leap days.
- Security: snippet delete rejects traversal ids; session import validates id/title/tags/overwrite.
- Test isolation: `npm test` no longer overwrites real `data/`.

## [1.0.1] - 2026-11-25

### Fixed
- Installation: Windows installer now preflights Node.js 22.13+ with actionable messages; launcher no longer hides npm failures, uses `--omit=dev`, and records a dependency marker. Inno uninstall removes stale `node_modules`/lockfiles; `install.ps1` preserves `data/` and handles GitHub source zips.
- Packaging: `package.json` is the single version source; CI checks version strings across installer/docs/changelog. Release workflow honors its `tag` input, derives versions from the tag, refuses mismatches, and publishes SHA-256 checksums. Standalone binary builds use pkg 6 + Node 24 targets and `--out-path` (pkg 5/node22 produced broken binaries).
- Web UI: chat now posts `message` (server API field), onboarding actually applies the chosen model and auth token, token auth is read per request with a constant-time comparison, and tool auto-approval from the browser is opt-in (`AEGISAI_WEB_AUTO_APPROVE`).
- TUI: fixed a temporal-dead-zone `root` reference that made `node src/index.js --tui` crash immediately.
- Offline: Preact/htm/Tailwind are vendored under `public/vendor/`; service worker is registered, versioned, and caches all UI assets.
- Security: static file serving rejects `../` and encoded traversal paths; new `src/http_utils.js` helper with tests.
- npm global installs: added a shebang and a `preinstall` Node version guard so `npm i -g` fails clearly on unsupported runtimes instead of leaving a broken CLI.

### Added
- `scripts/check-version-consistency.js`, `scripts/check-node.js`, `docs/TROUBLESHOOTING.md`, and regression tests for entry points, web auth, path traversal, and UI wiring.

## [0.64.0] - 2026-11-21 through 2026-11-25

See ROADMAP.md and git history for per-version detail (v0.64–v0.85). Highlights:

- v0.64–v0.66: UX overhaul and enhancements (onboarding wizard, command palette, toast notifications, dashboard, help panel, keyboard shortcuts, session sidebar, drag-and-drop, tool timeline, responsive layout). 59 issues closed.
- v0.67: publishing setup (npm OIDC trusted publishing, Docker/GHCR, Pages, Discussions, wiki, AirLLM provider, ledger seq-collision fix, installer version fix, --version flag).
- v0.68–v0.74: web UI overhaul (Preact, vendored deps, CORS, auto-start Ollama, model management, streaming chat, conversation export, multi-model comparison, file browser, conversation search, themes, keyboard shortcuts, auto-update).
- v0.75–v0.77: issue fixes (#60–#90), batch 1 & 2 UX (file browser, conversation search, themes, split editor, attachment chips, session tags).
- v0.78–v0.80: issue fixes (#85–#94), batch 3 (model probes, skill scanner, verified secret scanning, audit pipeline, MCP inspector, nuclei templates, crawler, remediation, doc conversion, handoff, conversation templates, A/B testing, browser vision tools).
- v0.81–v0.85: batch 4 & 5 (http probe, pentest eval, tiny router, deck PDF, skill schema, architecture map, guardrail API, IoC import, synthetic logs, Teams/Mattermost, agent CLI adapters, package guard, LSP rename, multi-model A/B, malware scan, i18n, skills catalog, a11y/PWA), plus issue fixes (#95–#99).

## [0.63.0] - 2026-11-22

### Added
- Plugin marketplace maturity: categories, ratings, tags, filters, enable/disable, update, info, stats
- Install from content/URL with dependency auto-install
- 8 curated featured plugins

## [0.62.0] - 2026-11-22

### Added
- Interactive multi-file diff review UI (accept/reject hunks per file)

## [0.61.0] - 2026-11-22

### Added
- Model provider breadth: 18 providers (Ollama, LM Studio, llama.cpp, vLLM, text-gen-webui, KoboldCpp, LocalAI, Jan, OpenAI, Anthropic, Groq, Mistral, DeepSeek, Together, Fireworks, Cohere, OpenRouter, Gemini) with auto-detection
- Plugin marketplace (search, install, uninstall, list)

## [0.60.0] - 2026-11-22

### Added
- Multi-file diff review (parseDiff, review, fullReview, stagedReview, unstagedReview, applyHunks)

## [0.59.0] - 2026-11-22

### Added
- Git-aware editing: status, diff, commit, blame, branch, stash, log, show, reset, auto-commit
- `--auto-commit` flag

## [0.58.0] - 2026-11-22

### Added
- Multi-pane TUI (status bar, chat, sidebar, command palette)
- LSP client (hover, definition, completion, diagnostics, didOpen)
- `--tui` flag

## [0.57.0] - 2026-11-22

### Added
- Tailwind CSS via CDN
- pdf-parse support in office preview
- Proper Windows installer (Inno Setup)
- README rewrite
- aegisai-next deprecated
- Repository made public

## [0.56.0] - 2026-11-22

### Added
- Swarm orchestration, dependency patch proposals, phase-based tasks
- Bug-hunting flow, awesome-re 17k index, MCP presets
- Vuln-patterns library, markdown memory, metrics

## [0.55.0] - 2026-11-22

### Added
- Preact web UI (via CDN, zero npm deps)

## [0.54.0] - 2026-11-22

### Added
- Native RE tooling (REA, Ghidra, Craft modules)
- Expanded RE index (30+ entries, categories, online search)

## [0.53.0] - 2026-11-22

### Added
- Private knowledge base, DingTalk/Feishu channels, Office preview
- PAT-gated stream actions, filesystem MCP resources
- Tool variants, tool annotations, access management IaC

## [0.52.0] - 2026-11-22

### Added
- IM channel adapters (Telegram, Discord)
- GitHub webhook event-driven agents
- File attachments, graph memory via MCP

## [0.51.0] - 2026-11-22

### Added
- Projects with instructions + document shelf
- Hippocampus memory, skill factory, UI replay, embedded Python client

## [0.50.0] - 2026-11-22

### Added
- Session goals, personal access tokens, token dashboard
- Proof-of-work artifacts, Codex-style approval modes

## [0.49.0] - 2026-11-22

### Added
- Roadmap from deer-flow, symphony, codex exploration

## [0.48.0] - 2026-11-22

### Added
- MCP protocol extensions (conformance, Apps, Tasks, .mcpb, interceptors, uploads, skills)

## [0.47.0] - 2026-11-22

### Added
- Streamable HTTP MCP server mode
- MCP reference servers (sequential thinking, fetch_url, time, registry browser, Everything fixture)

## [0.46.0] - 2026-11-22

### Added
- MCP reference servers from modelcontextprotocol/servers

## [0.45.0] - 2026-11-22

### Added
- Full app parity (keyless engines, simulated approval, citations, netvein, vision, proxy abort, RE index, AST chunking, remote docs)

## [0.44.0] - 2026-11-22

### Added
- App-parity gaps (rich chat UI, memory RAG, model discovery, lenient parsing, SSRF guard, context meter, UI config, default skills, squeeze)

## [0.43.0] - 2026-11-22

### Added
- Reliability & verification (session briefs, deterministic compaction, error recovery, chaos, silent-failure, honesty, boundary bench, replay guard, MCP pinning, Merkle, readiness, trajectory UI, cost routing, tool contracts, agents-as-tools, equipment registry)

## [0.42.0] - 2026-11-22

### Added
- Roadmap from harness tools search pages 5-8

## [0.41.0] - 2026-11-22

### Added
- Tool systems & evidence (tool state/eval, evolution search, config matrix, migration recipes, confidence memory, event replay, context reset, identity audit, 5-layer spans, evidence bundles, composable APIs)

## [0.40.0] - 2026-11-22

### Added
- Roadmap from harness tools search pages 1-4

## [0.39.0] - 2026-11-22

### Added
- Clear remaining deferred (simulated browser, plugin UI, 5-layer security, layer registry, markdown governance, trace export, native adapters)

## [0.38.0] - 2026-11-22

### Added
- DiggerHQ integrations (Slack gateway, WS bridge, serverless, Podman, PR review, CI resolver, CVE reachability)

## [0.37.0] - 2026-11-22

### Added
- DiggerHQ patterns (brain/sandbox, health failover, git state, bug repro, maintenance templates, speed bench, runtime contract, sandbox fingerprint)

## [0.36.0] - 2026-11-22

### Added
- Roadmap from diggerhq with feasibility ratings

## [0.35.0] - 2026-11-22

### Added
- Decisions & interop (decision gates, workflow state machine, two-bar goals, geometric memory, session converter, arch rules, AIBOM, SSH bridge)

## [0.34.0] - 2026-11-22

### Added
- Retrieval & reporting (semantic tools, YAML evals, pass@k, failure clusters, ledger rewind, Gems, AHP gateway, SARIF)

## [0.33.0] - 2026-11-22

### Added
- Interfaces & governance (dual-graph memory, constitution, BiDi, SSE, config installer, multi-search, routing eval, control plane)

## [0.32.0] - 2026-11-22

### Added
- Memory & control (graph memory, UI replay, executor/verifier separation, self-writing policy, debugger, cheapest-model finder, code-flow map)

## [0.31.0] - 2026-11-22

### Added
- Protocol & isolation (A2A, DAG editor UI, local voice, sealed Docker, multi-tenant)

## [0.30.0] - 2026-11-22

### Added
- P2 platform (task board, context FS, event bus, ACP, benchmarks, docs, pentest pipeline)

## [0.29.0] - 2026-11-22

### Added
- Security & local inference (hardware detect, gateway, admission, vuln scanner, security KB, deep research, continual, memory hierarchy)

## [0.28.0] - 2026-11-22

### Added
- Ecosystem & tooling (runtime manager, shadow AI, skill packages, MCP marketplace, self-improvement, templates/themes/RPC, harness-as-code, config discovery)

## [0.27.0] - 2026-11-22

### Added
- Context & control (AX browser, capsules, rollback, task state, web search, slop filter, peer review)

## [0.26.0] - 2026-11-22

### Added
- Audit & evolution (ledger, action guardrails, counterfactual evolution, file-first verification, waste detection, mailbox)

## [0.25.0] - 2026-11-22

### Added
- Trust & governance (lifecycle, PII, charter, Windows robustness, pairing evals, bi-temporal memory)

## [0.24.0] - 2026-11-22

### Added
- Teams & interfaces (teams, JSON CLI, context files, read-only, markdown extract)

## [0.23.0] - 2026-11-22

### Added
- Trust & tuning (MCP security scanner, source-bound memory, contract baselines, optimizer, cron)

## [0.22.0] - 2026-11-22

### Added
- Roadmap from harness search pages 4-6

## [0.21.0] - 2026-11-22

### Added
- Computer use (CDP browser tools)

## [0.20.0] - 2026-11-22

### Added
- DAG orchestration + multi-critic evaluation pipeline

## [0.19.0] - 2026-11-22

### Added
- Voice input/output (Web Speech API)

## [0.18.0] - 2026-11-22

### Added
- Run capture, harness score, reliability attribution

## [0.17.0] - 2026-11-22

### Added
- Roadmap from GitHub harness search

## [0.16.0] - 2026-11-22

### Added
- Integration/skills/memory panels, version/errors/backup UI, Docker, RE wiring, allowlist

## [0.15.0] - 2026-11-22

### Added
- Web UI branching, approval, model mgmt, PWA, auth/rate limit, installers

## [0.14.0] - 2026-11-22

### Added
- Integration/skills/memory panels, version/error-log/backup UI

## [0.13.0] - 2026-11-22

### Added
- Ecosystem exploration 2 items

## [0.12.0] - 2026-11-22

### Added
- Ecosystem exploration 1 items

## [0.11.0] - 2026-11-22

### Added
- Packaging (build script, install script, offline update checker)

## [0.10.0] - 2026-11-22

### Added
- Policy engine, sandbox rings, skill auto-create, session search, capture, observability

## [0.9.0] - 2026-11-22

### Added
- Async/background tools, state-diff grading, large-tool-set stress, advanced routing, TOML config, benchmark suites

## [0.8.0] - 2026-11-22

### Added
- Tool sets, SKILL.md import, proxy mode

## [0.7.0] - 2026-11-22

### Added
- Enhanced doom-loop, richer hooks, tool context, format converters, OTel export

## [0.6.0] - 2026-11-22

### Added
- Richer hooks, enhanced doom-loop, state-diff grading, advanced routing, conversation state accessor

## [0.5.0] - 2026-11-22

### Added
- Doom-loop detection, composable stop conditions, mock MCP services, tool-payload stress testing, multi-backend router

## [0.1.0] - 2026-11-22

### Added
- Initial harness scaffold: agent loop, tool registry, backends, storage, MCP client, compaction, hooks, tracing, eval, vault, backup, proxy, web UI
