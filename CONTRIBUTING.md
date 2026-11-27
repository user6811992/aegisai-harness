# Contributing to AegisAi Harness

## Getting started

```bash
git clone https://github.com/user6811992/aegisai-harness.git
cd aegisai-harness
npm install
npm test          # 487 tests, all must pass
npm start         # run the harness
```

Requires Node.js 22.13+.

## Development workflow

1. Fork the repo and create a feature branch.
2. Make your changes.
3. Run `npm test` — all tests must pass.
4. Run `node scripts/run-lint.js` — no errors.
5. Run `node scripts/run-stress.js` — adversarial stress must pass.
6. Submit a pull request.

## Code conventions

- **Zero dependencies** (except optional `better-sqlite3` and `pdf-parse`). If you need a library, add it as an optional dependency and provide a fallback.
- **One module per concern** — keep files focused and small.
- **No telemetry or phone-home** — the harness is local-first.
- **Security first** — all file ops go through `safePath()`, all URLs through `url_validate.js`.
- **Tests** — every new module gets a test file in `tests/vNNN.test.js`.

## Adding a new module

1. Create `src/your_module.js` with a clear `module.exports`.
2. Add a test file `tests/vNNN.test.js`.
3. Add REPL commands in `src/index.js` if applicable.
4. Add a ROADMAP.md entry.
5. Update `llms.txt` if it's a major capability.

## Commit messages

Use conventional commits: `feat(v0.XX): description`, `fix: description`, `docs: description`, `chore: description`.

## Code of conduct

Be respectful. This is a local-first, privacy-first project. No telemetry, no cloud dependencies, no tracking.
