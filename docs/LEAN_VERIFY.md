# Lean Formal Verification (Optional)

AegisAi Harness can optionally verify Lean 4 projects as part of its governance
and evidence workflow. This is inspired by
[@eelbaz/Rule30PrizeKit](https://github.com/eelbaz/Rule30PrizeKit), the reference
Lean environment for the Wolfram Rule 30 Prizes.

> This is **opt-in**. The Lean 4 + Mathlib toolchain (~6 GB) is not bundled.

## Availability

Check whether the toolchain is installed:

```bash
node -e "console.log(require('./src/lean_verify').available())"
# or via the MCP tool `lean_verify_status`
```

You need `elan` (the Lean toolchain manager) and `lake` on PATH:

```bash
curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh
```

## Verifying a project

```bash
node -e "console.log(JSON.stringify(require('./src/lean_verify').verify('./my-lean-project'), null, 2))"
```

Or via the MCP tool:

```json
{ "name": "lean_verify_project", "arguments": { "projectDir": "./my-lean-project" } }
```

To verify a single file instead of building the whole project:

```json
{ "name": "lean_verify_project", "arguments": { "projectDir": "./my-lean-project", "file": "Proofs.lean" } }
```

The result includes `ok`, `exitCode`, `stdout`, and `stderr` so a verification
certificate can be attached to an `evidence_bundle`.

## Reference environment

`Rule30PrizeKit` pins:

- Lean 4.35.0
- Mathlib `56a005855e` (the `v4.35.0` tag)
- A checker for the official Problem1/Problem2 statements and their catalog of
  equivalent forms

Use it as a model for reproducible formal-verification environments.

---

Third-party toolchains retain their own licenses; see `THIRD_PARTY_NOTICES.md`.
