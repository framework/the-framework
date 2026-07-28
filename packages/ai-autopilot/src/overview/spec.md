Scale mode (#114) — maintains `CODE-OVERVIEW.md`, a compact always-current map of the codebase the agent reads first in a large repo, refreshed only when a change is *material*.

## TLDR

- `types.ts` — data model (`CodeOverview`, `MaterialChange`, `Regenerate`, `OverviewFs`) + design doc.
- `maintainer.ts` / `maintainer.test.ts` — `CodeOverviewMaintainer`: holds/loads/persists the overview, gates regeneration on materiality.
- `material.ts` / `material.test.ts` — `detectMaterialChange`: deterministic path/summary signals (build config, test tooling, cross-area bulk change, restructure words).
- `agent.ts` / `agent.test.ts` — `agentOverview` (ai-sdk-agent-backed `Regenerate`) and `overviewLoopPrompt` (maintainer as a loop prompt, id `code-overview`).
- `markdown.ts` / `markdown.test.ts` — lossless `CODE-OVERVIEW.md` ⇄ `CodeOverview` round-trip.
- `store.ts` — `loadOverview`/`saveOverview` over `OverviewFs`; `nodeOverviewFs()` adapter; `OVERVIEW_FILE`.
- `index.ts` — barrel.

## Facts

- Architecture: detection is pure/deterministic, regeneration is an injected agent call, persistence is an injected fs — so the whole policy is testable offline and runtime-agnostic (host disk or a runner-session sandbox).
- Wiring into the loop (#113) via `overviewLoopPrompt` is what makes the overview self-maintain: the loop hands events to the maintainer, which skips immaterial ones.
