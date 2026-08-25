# Bug analysis: packages/framework/src/layout.ts

## Business logic (high-level)

The layout gate (#1575): a build refuses to run in a repo whose tracked `.the-framework/LAYOUT` records different bookkeeping names than the build's own constants. Three responsibilities: name the marker (`LAYOUT_FILE`, `layoutMarkerPath`), derive the marker content from the live constants (`layoutMarker`), and compare (`checkLayout`).

Invariants checked:

- **Derivation, not duplication**: `layoutMarker()` reads `THE_FRAMEWORK_DIR`, `DATA_BRANCH`, `ARCHIVE_DIR`, `BRANCHES_DIR`, `EVENTS_FILE`, `META_FILE`, `TICKETS_DIR`, `FLAT_TODO_FILE` — I verified each constant's current value against the checked-in `/home/user/the-framework/.the-framework/LAYOUT` (framework-dir `.the-framework`, data-branch `tf-data`, archive-dir `agents`, branches-dir `branches`, events-file `events.jsonl`, meta-file `agent.json`, tickets-dir `tickets`, queue-file `TODO_AGENTS.md`): all match, and the lockstep test enforces this on rename PRs. The SPEC's list of names ("framework directory, data branch, archive directory, worktree directory, event log and agent meta file names, tickets directory, agent queue file") maps one-to-one onto the eight lines.
- **Unmarked repo is ungated** — `exists()` false returns `{ok: true}`; matches SPEC ("activation writes the marker").
- **Refusal is a value, never a throw** — mismatch returns `{ok: false, error}` with both layouts in full and both fixes named; matches SPEC.
- **Comparison is exact string equality** — the marker is "pure data" ending in a newline; a trailing-whitespace or CRLF difference would refuse. On Windows with `core.autocrlf=true`, a *tracked* text file can materialize with CRLF line endings in the checkout, in which case `recorded !== layoutMarker()` even though the layouts agree — a false refusal. Whether this is reachable depends on whether the product supports Windows checkouts with autocrlf (the codebase elsewhere notes `du` "missing on Windows", implying Windows is at least contemplated). Recorded as suspicious-but-unproven, low confidence; the fix (normalize `\r\n` before comparing, or `.gitattributes`) is one line.

Failure modes: a race between `exists()` and `read()` (marker deleted in between) would throw out of `checkLayout` despite the "never a throw" contract — but the marker is a tracked file nothing deletes at runtime, so callers provably never produce this; noted as a reliance, not a bug. An unreadable marker (permissions) likewise throws; same reasoning.

## Functions (low-level)

- **`LAYOUT_FILE`** — `'LAYOUT'`; consumed by `framework-gitignore.ts` (`!LAYOUT` re-include) and install. Correct.
- **`layoutMarkerPath(cwd)`** — plain join. Correct.
- **`layoutMarker()`** — eight `name: value` lines plus trailing `''` for the final newline. Deterministic, no comment line (deliberate: wording must not enter the equality). Correct.
- **`checkLayout(cwd, fs)`** — exists → pass-if-absent → read → strict equality → refusal value. The refusal message embeds both layouts and both remedies; `layoutMarker()` is called twice (once for compare, once for message) — pure function, harmless. Injected `StoreFs` default `nodeStoreFs()` evaluated per call — fine. Verdict: correct (with the CRLF caveat above).

## Bugs found

1. `L63`: `checkLayout` compares byte-for-byte, so a checkout that materializes the tracked marker with CRLF line endings (Windows, `core.autocrlf=true`) is refused even when the recorded layout is identical — a false "layout mismatch" refusal whose error text shows two visually identical layouts. Contradicts intent: the gate is meant to catch *renames*, not line-ending conventions. Severity: minor. Confidence: low (Windows support status unclear; no `.gitattributes` in the repo forces LF). Fix sketch: compare after `recorded.replace(/\r\n/g, '\n')`, or add `.the-framework/LAYOUT text eol=lf` to `.gitattributes`.
