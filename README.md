# AegisAi Harness

A **feature-rich, local-only AI agent harness** — OpenCode-class runtime, but
offline-first: no cloud dependencies, no telemetry. 56 milestones, ~200 modules,
213 tests, CI green.

> Status: v0.57.0 (see [ROADMAP.md](./ROADMAP.md)).
> **Successor to [aegisai-next](https://github.com/user6811992/aegisai-next)** — that project is deprecated; all features have been ported here.

## What a harness is here

The harness is the runtime that hosts an agent loop around a local LLM:

- **Agent loop** with tool calls, streaming, fallback models, iteration caps, doom-loop detection, composable stop conditions.
- **Tool registry** with 64+ coding tools plus pluggable external tools (MCP, plugins, REA, Ghidra, Craft).
- **Capability-based security** (allowed/denied tool patterns per session, sandbox rings, clean room mode).
- **Session & memory persistence** in local SQLite with WAL (bi-temporal memory graph, hippocampus, source-bound memory).
- **Context management** (compaction + retrievable archive + capsules).
- **Local-only guarantees** (offline mode, local embeddings, no phone-home).
- **MCP client + server** (stdio + Streamable HTTP, conformance, Apps, Tasks, .mcpb, interceptors, uploads, skills).
- **Web UI** (Preact via CDN, Markdown rendering, context meter, dark/light theme, voice, config panel).
- **Reverse engineering** (REA, Ghidra, Craft, awesome-re 17k index, squeeze, pentest pipeline, vuln scanner).
- **Observability** (run capture, harness score, reliability attribution, OTel export, SARIF, Merkle ledger).
- **Always-on layer** (events, timers, approvals, outbox, scheduler, cron, mailbox).
- **Multi-agent** (DAG orchestration, swarm, teams, multi-critic, task phases).
- **Quality gates** (skill eval, harness lint, adversarial stress, CI template, conformance).

## Quick start

```bash
git clone https://github.com/user6811992/aegisai-harness.git
cd aegisai-harness
npm install
npm start
```

Requires Node 22.5+ and a local backend (Ollama recommended).

### Web UI

```bash
npm start -- --web
# Open http://127.0.0.1:8080
```

### MCP server (for Claude Code, Cursor, etc.)

```bash
npm start -- --mcp-server
# Connect to http://127.0.0.1:3001/mcp
```

### Headless / CI

```bash
node src/index.js --json "your prompt here"
```

## Layout

```
src/
  index.js            entry point (CLI / web / MCP server / RPC)
  core/               config, logger, security, capabilities
  agent/              agent loop (run.js), compact.js
  tools/              tool registry + coding tools
  backends/           backend adapters (Ollama, OpenAI-compat, router)
  storage/            SQLite persistence
  integrations/       MCP client, browser (CDP), retools
  (140+ modules)      policy, charter, ledger, hooks, doomloop, ...
public/               web UI (Preact via CDN, no build step)
tests/                node:test suites (213 tests)
packaging/            Windows/macOS/Linux installers + binary build
```

## Build

```bash
# Windows installer (requires Inno Setup 6)
.\packaging\build.ps1 -Installer

# Standalone binary
.\packaging\build.ps1 -Binary

# Or use the cross-platform binary script
bash packaging/build-binary.sh
```

## Environment variables

See [ROADMAP.md](./ROADMAP.md) for the full list. Key ones:

| Var | Purpose | Default |
|---|---|---|
| `PORT` / `HOST` | Bind address | 127.0.0.1:8080 |
| `AEGISAI_TOKEN` | Auth token (open mode if unset) | (none) |
| `AEGISAI_OFFLINE` | Force offline mode | false |
| `BACKEND_TYPE` | Backend type (auto/ollama/openai) | auto |
| `BACKEND_URL` | Backend URL | auto-detect |
| `AEGISAI_DATA_DIR` | Data directory | ./data |
| `AEGISAI_PROJECT_ROOT_ALLOWLIST` | Allow-list for agent project roots | (none) |

## License

MIT

## Acknowledgments

Built with inspiration from the open-source community. See [ROADMAP.md](./ROADMAP.md) for the full list of explored projects and patterns.
```
