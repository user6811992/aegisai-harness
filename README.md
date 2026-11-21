# AegisAi Harness

A **feature-rich, local-only AI agent harness**. OpenCode-class runtime, but
offline-first: no cloud dependencies, no telemetry, no third-party CDN loads.

> Status: early scaffold (v0.1.0). See [ROADMAP.md](./ROADMAP.md).

## What a harness is here

The harness is the runtime that hosts an agent loop around a local LLM:

- **Agent loop** with tool calls, streaming, fallback models, and iteration caps.
- **Tool registry** with coding tools (file ops, shell, python, search) plus
  pluggable external tools (MCP, plugins).
- **Capability-based security** (allowed/denied tool patterns per session).
- **Session & memory persistence** in local SQLite with WAL.
- **Context management** (compaction + retrievable archive) — planned.
- **Local-only guarantees** (offline mode, local embeddings, no phone-home).

## Quick start

```bash
npm install
npm start
```

Requires Node 22.5+ and a local backend (Ollama recommended).

## Layout

```
src/
  index.js            entry point
  core/               config, logger, security, capabilities
  agent/              agent loop (run.js)
  tools/              tool registry + coding tools
  backends/           backend adapters (Ollama, OpenAI-compat)
  storage/            SQLite persistence
tests/                node:test suites
```

## License

MIT
