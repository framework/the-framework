# Bug analysis: packages/framework/dashboard/components/Agents.tsx

## Business logic (high-level)

The Overview's Agents card (#1139): props-only projection of `ActiveAgent[]` (the daemon's
"working right now" pool, cloud sides included). Checked against `Agents.SPEC.md`:

- **Only what is working now** — the component renders exactly what `working` holds; the
  filtering (running + cloud in-cloud/waiting, finished excluded) is the server projection's
  job (`src/dashboard/overview.ts`), and the card adds nothing. Loading state distinct from
  empty ("Loading…" vs "No agents working right now.") ✓ — the SPEC's "while the list is still
  being fetched it says so".
- **A row opens the agent itself** — `onOpen` calls `onSelectAgent(projectId, agentId)`, both
  ids, never just the project (#1189). The whole line is the button; no per-row hint (the
  comment explains the tooltip-collision rationale). ✓
- **Row contents** — label via `activeLabel`, cloud word ("waiting"/"in cloud"), project name,
  "from <host>" only when `host` set (the projection only sets it for other machines' runs),
  age with exact timestamp on hover (`formatAge`/`formatDateTime`), rendered only when
  `updatedAt` exists (it is optional on `ActiveAgent`). ✓

Edge cases: key `${projectId}:${agentId}` unique across projects ✓; `activeLabel` trims each
candidate so whitespace-only intent falls through (test-pinned) and ends at `projectName`
(always present) so a row is never blank ✓ — the SPEC's exact fallback chain
(intent → session name → scope → project). `cloud` chip text maps the two values explicitly;
an impossible third value would render nothing rather than lie. No state, effects, or
subscriptions; re-render safe.

One SPEC nuance: the SPEC's row description mentions "how long ago it was last active" —
`updatedAt` is optional in the type, and a row without it simply omits the age instead of
rendering "Invalid Date"; correct handling of the optional.

## Functions (low-level)

- **`Agents({ working, loading, onSelectAgent })` (L17)** — three-way body: loading / empty /
  list. Order matters (loading checked first) and matches "loading is not the same as empty".
  Correct.
- **`AgentRow` (L63)** — one `<button>` per `<li>`; baseline-aligned spans, truncation on the
  label only (`min-w-0 flex-1`), fixed pieces `shrink-0`. The age tooltip is the only nested
  interactive-ish element and it is a span, so no nested-button a11y hazard. Correct.
- **`activeLabel(a)` (L116)** — `a.intent?.trim() || a.sessionName?.trim() || a.scope?.trim()
  || a.projectName`; `''` from trim falsy-chains onward — exactly the SPEC chain. Correct.

## Bugs found

None found.
