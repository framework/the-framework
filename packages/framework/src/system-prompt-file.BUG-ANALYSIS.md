# Bug analysis: packages/framework/src/system-prompt-file.ts

## Business logic (high-level)

The one Node-bound half of the system-prompt feature: it reads the user's `SYSTEM.md` from a
directory and hands back plain text. Its whole reason for existing as a separate module is the
browser-graph invariant (#520/#431): `system-prompt.ts` composes the channel and the dashboard
imports that composition through `client.ts`, so nothing reachable from `client.ts` may import
`node:*`. `client.test.ts` walks the built `client.js` import graph and fails on any `node:` import,
which is what keeps this split honest — this module is deliberately *not* re-exported from
`client.ts`; the dashboard gets the text through the RPC `onSystemPromptUser` (dashboard-rpc/reads.ts
L410) instead.

Lifecycle: the CLI reads it once per agent (`resolvePromptConfig`, cli.ts L487) from the workspace
root `cwd` and threads the string into `runAgent({ systemPrompt })` → `composeAgentSystem({ user })`.
Reading it once on the shared path (rather than inside the composer) is what lets the same text be
shown in the dashboard preview and injected into the agent.

Invariant it must uphold, per `system-prompt-file.SPEC.md`: "An absent or empty file yields nothing,
so the caller falls back to the built-in system prompt alone." Both callers (`cli.ts`,
`onSystemPromptUser`) treat `undefined` as "no user prompt" — cli.ts only spreads `systemPrompt`
into the agent options when truthy, and `systemPromptBlock` ignores a whitespace-only `user` anyway,
so the empty→`undefined` normalization is belt-and-braces rather than load-bearing.

Failure modes considered:

- **File absent** — `readFile` rejects ENOENT, caught, `undefined`. Intended.
- **Whitespace-only file** — trimmed to `''`, `|| undefined` returns `undefined`. Intended, pinned
  by a test.
- **`SYSTEM.md` is a directory / unreadable (EACCES) / invalid UTF-8** — all collapse to
  `undefined`, silently. Nothing tells the user their `SYSTEM.md` was skipped. In a repo that
  deliberately prefers simple code this is the accepted trade: the caller's echo line
  (`◆ system prompt: SYSTEM.md`) simply does not print, which is the same signal as "no file".
  Not a defect against any stated intent.
- **Concurrency** — pure read, no shared state, no caching, so repeated/parallel calls are safe.
  A `SYSTEM.md` edited mid-agent does not affect a session already started (the text was captured
  before the session opened), which matches the "nothing is read off disk and appended at run time"
  claim (#547) that the dashboard preview rests on.
- **Encoding/BOM** — a UTF-8 BOM would survive `trim()` (U+FEFF is trimmed by `String.prototype.trim`
  in modern V8 — it is in the `WhiteSpace` set — so even that is handled).

## Functions (low-level)

### `SYSTEM_PROMPT_FILE` (L15, exported const)
The literal `'SYSTEM.md'`. Used by `cli.ts` for the echo line and by the tests. Single source of
the name; no duplicate literal elsewhere in the callers. Correct.

### `loadUserSystemPrompt(dir, file = SYSTEM_PROMPT_FILE)` (L22)
Reads `join(dir, file)` as UTF-8, trims, returns the text or `undefined`; any throw becomes
`undefined`.

Edge cases:
- `dir` relative → resolved against `process.cwd()` by `readFile`; both callers pass an absolute
  workspace path (`resolveProjectPath` / cli's `cwd`), so this never bites.
- `file` is never passed by production callers (the second parameter exists only as a seam);
  therefore no path-traversal surface — `dir` comes from the registry, not from a browser payload.
  The dashboard RPC resolves `projectId` → registered path before calling, so a browser cannot
  point this at an arbitrary file.
- Large file: read fully into memory. `SYSTEM.md` is hand-written; not a concern.
- The `catch {}` swallows *every* error including programming errors (e.g. `dir` being `undefined`
  would throw a TypeError inside `join` — but that throws *outside* the try? No: `join(dir, file)`
  is evaluated inside the `try`, so even that degrades to `undefined`). Slightly over-broad, but no
  reachable caller passes a non-string.

Verdict: correct.

## Bugs found

None found.
