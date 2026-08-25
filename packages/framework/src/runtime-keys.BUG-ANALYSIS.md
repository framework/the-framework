# Bug analysis: packages/framework/src/runtime-keys.ts

## Business logic (high-level)

The single home of the composite key scheme for the daemon runtime's per-project in-memory state
(#736), shared by the agent runtime and the preview runtime: `<projectKey>::<agentId>` for an
agent-scoped entry, and the bare `<projectKey>` for a project-scoped one (a fallback agent with no
worktree, or a project's preview). Three call sites used to hand-roll the encoding, the prefix match and
the split independently; centralising them is the whole point, so the invariant to check is that
building, splitting and prefix-matching are mutual inverses for every key the system actually mints.

The encoding is unambiguous only if `projectKey` cannot itself contain `::`. It cannot: a project key is
`projectId(path)` (`registry.ts` L241-251), which is `basename(path).toLowerCase().replace(/[^a-z0-9-]/g, '-')`
plus `-` plus a base36 djb2 hash — a string over `[a-z0-9-]` only, so no colon can appear. `parseScopedKey`
splitting on the *first* `::` therefore always cuts at the real separator, and `keyBelongsTo`'s
`startsWith(projectKey + '::')` cannot match a different project whose key merely shares a prefix,
because the separator is part of the compared string.

An agent id (`store/agent-store.ts` `isSafeAgentId`, `/^[A-Za-z0-9_-]+$/`) also cannot contain `::`; even
if it could, `indexOf` cutting at the first separator would still recover both halves correctly, since
the remainder is handed back whole.

Round-trip: `parseScopedKey(scopedKey(p))` → `{ projectKey: p }` (no `agentId` property, so
`?.agentId` is `undefined`, which is what `daemon-runtime.ts` L880/L885/L895/L925 tests for);
`parseScopedKey(scopedKey(p, a))` → `{ projectKey: p, agentId: a }`. The one degenerate input is
`scopedKey(p, '')`, which the ternary treats as project-scoped (empty string is falsy) and therefore
yields the bare project key — consistent with the "absent agent id" case rather than producing a
trailing-`::` key that nothing could parse back. Call sites pass `workspace.agentId` / `continueAgentId`,
never `''`.

No lifecycle, no I/O, no async, nothing to leak.

## Functions (low-level)

- `scopedKey(projectKey, agentId?)` — returns `` `${projectKey}::${agentId}` `` when `agentId` is
  truthy, else `projectKey`. Edge cases: `undefined`/`''` agent id ⇒ project-scoped (deliberate, see
  above); a `projectKey` containing `::` would be ambiguous but is unreachable given `projectId`'s
  charset. Verdict: correct.
- `parseScopedKey(key)` — `indexOf('::')`; `-1` ⇒ `{ projectKey: key }`, else slices at the separator
  and takes the rest (`separator + 2`, correct for the two-character separator — no off-by-one). A key
  ending in `::` yields `agentId: ''`, which is falsy and so behaves as "no agent" at the call sites
  that use `?? …`; nothing mints such a key. Verdict: correct.
- `keyBelongsTo(key, projectKey)` — exact match (the project-scoped entry) or the `projectKey::` prefix
  (one of its agents). Rejects a sibling project whose key is a strict prefix of another's, because the
  separator is included in the prefix test — the specific bug the hand-rolled call sites were prone to.
  Verdict: correct.

## Bugs found

None found.
