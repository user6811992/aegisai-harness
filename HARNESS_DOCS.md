# AegisAi Harness — engineering docs

## Architecture teardown

The harness is an agent runtime: the model thinks, the harness decides what that thinking may touch.

Layers:
1. **Backends** (`src/backends`) — Ollama + OpenAI-compatible, streaming, routing, circuit breakers.
2. **Agent loop** (`src/agent/run.js`) — tool calls, fallback models, budgets, gates (policy, charter, read-only, action guard, admission, MCP security), hooks, doom-loop detection, capsules, ledger capture.
3. **Tools** (`src/tools`) — coding tools, registry, capability filtering, tool sets, discovery, output compression.
4. **Integrations** (`src/integrations`) — MCP client + security scanner, CDP browser (AX-first), REA/Ghidra/Craft.
5. **Memory & context** — SQLite persistence, compaction + archive, source-bound/bi-temporal memory, context files, context filesystem, capsules.
6. **Quality** — evals, benchmarks, harness score, reliability attribution, counterfactual optimizer, adversarial tests, CI template.
7. **Interfaces** — CLI/REPL, `--web` UI, `--rpc`, OpenAI-compatible `--proxy`, JSON `--json`. The web UI's Preact/Tailwind assets are vendored in `public/vendor/` (no CDN), and the service worker caches them for offline restarts. Web chat does not auto-approve tool calls unless `AEGISAI_WEB_AUTO_APPROVE=true`.

## Guides

- **Build your own harness:** see `src/agent/run.js` and `src/tools/registry.js` — a loop, tools, a permission gate, a context file, a budget, a resumable transcript.
- **Add a tool:** register in `src/tools/registry.js`; add execution in `src/tools/coding.js`; declare capabilities.
- **Add a gate:** implement a pure `enforce(name, args, ctx)` function and wire into `src/agent/run.js` before tool execution.
- **Add an MCP server:** configure in `.mcp.json` or via the REPL `/mcp` commands; the security scanner (`src/mcp_security.js`) checks tool descriptions before loading.
- **Set project rules:** write `.aegisai/charter.yaml` with `protected_paths`, `forbidden_tools`, `require_approval`, `quality_gates`.
- **Run offline:** `AEGISAI_OFFLINE=true` removes network tools; all backends can be local.

## Playbooks

- **Test-drive on your repo:** `/eval`, `/bench`, `/pairing <model>` — measure before and after config changes.
- **Harden:** `/lint`, `/stress`, `/vuln-scan <path>`, `/admit <tool>`, `/gw-allow`, `/charter`.
- **Recover:** `/rollbacks`, `/rollback <id>`, `/ledger-replay`, `/capsule` resume.
- **Improve:** `/diagnose`, `/evolve`, `/self-improve`, `/continual`, `/memory-hierarchy`.

## Non-goals
- Cloud-hosted backends as a requirement (local-first always).
- Telemetry or phone-home.
