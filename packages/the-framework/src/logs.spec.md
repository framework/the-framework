The `.the-framework/LOGS.md` project log (#378): a committed, human-readable markdown record of every loop, prompt, and build run, with render/parse both directions.

## TLDR

- `LogEntry`: `at` (ISO), `kind` (`loop|prompt|build`), `title`, `status` (`done|stopped|failed|running`), optional `id`, `sessionId`/`sessionLink`, `sessionName`, `branch`, `prompts[]`.
- `renderLogEntry`/`parseLogs` serialize an entry to/from a `## `-headed markdown block; `appendLog` appends (creating dir + one-time header), `readLogs` returns entries newest-first.
- `LOGS_GITIGNORE` (#313): an allowlist `.gitignore` for `.the-framework/` — ignore `*`, negate `.gitignore` and `LOGS.md` — so the committed DB coexists with transient run state.
- Pure core over the `StoreFs` seam (same as the run store), unit-testable off disk.

## Problems

- Injection into committed history (#897): a title is the run's prompt and a prompt bullet is agent text, but the file is parsed line by line — an unescaped newline spills the prompt into the file where a `## ` line forges an entry and a `- status: ` line rewrites one. `encodeField` escapes `\` and newlines to `\n` literals; `decodeField` reverses. Pre-#897 entries decode a literal `\n` to a newline (accepted as harmless).
- Render/parse drift: the single-line `- key: ` fields live in one `LOG_FIELDS` table where each field owns both its render and parse (and its own encoding), so name/prefix/escaping can never drift between the two sides — the file's one real hazard when they were hand-mirrored.

## Decisions

- Heading format: `## <at> · <kind> · <title>` with a middle-dot separator (`' · '`); the parser re-joins `parts.slice(2)` so a title containing the separator survives.
- `branch` (#799) is read from the checkout as the run settles because it is not derivable later: a clean run loses its worktree and the agent may have branched itself.
- `id` (#898) is the join key from this committed entry to the transient `runs/<id>.json` / `runs/<id>.jsonl` that stay out of git.
- Parsing is forgiving: malformed or torn entries are skipped, never thrown; anything before the first `## ` (the file header) is ignored.
- The allowlist gitignore means anything else meant to be committed needs its own negation — `CONVERSATIONS_GITIGNORE` (#908) and project presets append theirs.
- `THE_FRAMEWORK_DIR` lives in its own node-free module (#874) so the browser-reachable preset registry can share it; re-exported here where existing imports expect it.

## Facts

- File header is exactly `# The Framework logs\n`, written once on first append.
- The `- session: ` line renders as `[<id>](<link>)` when a link exists, plain id otherwise; parse handles both.
- `readLogs` reverses append order (oldest-first in file → newest-first returned).
