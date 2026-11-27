# Dataset Tools

Local-only JSON/JSONL dataset curation for LLM training/eval data. Implemented
clean-room in `src/dataset.js` — inspired by
[eelbaz/LostRuins datasetexplorer](https://github.com/LostRuins/datasetexplorer)
(AGPL-3.0). **No code was copied**; only the feature ideas were reused, so this
MIT-licensed harness remains legally independent.

## Supported formats

| Format | Detection | Text extraction |
|---|---|---|
| `text` | plain string | the string itself |
| `alpaca` | has `instruction`/`output` | instruction + input + output (1 turn per non-empty field) |
| `sharegpt` | has `conversations[]` | each `{from, value}` is one turn |
| `generic` | any nested object/array | flattened scalar values |

## CLI / MCP tools

| Tool | Purpose |
|---|---|
| `dataset_stats` | Counts, formats, avg words, top n-grams |
| `dataset_filter` | Filter by chars/words/turns/matches + regex or substring search; optional sort |
| `dataset_ngram` | N-gram frequency (sorted desc) |
| `dataset_dedupe` | Exact or normalized (lowercase, punctuation-stripped) dedup |
| `dataset_merge` | `merge` / `replace` / `subtract` modes |
| `dataset_replace` | Regex or substring find/replace (supports `dryRun`) |
| `dataset_export` | Export to JSON or JSONL |

All tools are exposed as MCP tools and callable via `dataset.dispatch(name, args)`.

## Examples

```js
const dataset = require('./src/dataset');

// Load a JSONL dataset with an element range
const { items } = await dataset.load('./data.jsonl', { start: 0, end: 100 });

// Filter: 2+ turns, containing "error" (regex), 2+ matches
const matched = dataset.filter(items, {
  search: 'error', regex: true, minTurns: 2, minMatches: 2,
});

// N-gram analysis for repetition detection
const grams = dataset.ngram(items, 3, { limit: 20 });

// Deduplicate (normalized)
const deduped = dataset.dedupe(items, { normalized: true });

// Regex replace with dry-run first
const preview = dataset.replaceText(items, 'https?://\\S+', '[LINK]', { regex: true, dryRun: true });
const applied = dataset.replaceText(items, 'https?://\\S+', '[LINK]', { regex: true });

// Export
dataset.writeExport(applied.items, './cleaned.jsonl', 'jsonl');
```

## Design notes

- **Streaming JSONL** via `readline` with element ranges (`0-100`, `50`) —
  handles large files without loading everything into memory for JSONL.
- **Regex-first** — the upstream project only supports substring replace (open
  issue #1); this implementation supports regex with validation from day one.
- **Normalized dedup** strips case and punctuation so `Hello, World!` and
  `hello world` collapse to one entry.
- **Deterministic shuffle** — optional seed for reproducible curation.

## Limitations

- JSON array files are parsed whole (chunk-size is used for progress semantics);
  very large datasets should be split or stored as JSONL.
- Field-level replace currently targets the first string field containing the
  pattern on object items.
- No Parquet support (JSONL is the recommended interchange format).

---

See also: `src/dataset.js`, `tests/dataset.test.js`, `THIRD_PARTY_NOTICES.md`,
`docs/FUTURE_INTEGRATIONS.md`.
