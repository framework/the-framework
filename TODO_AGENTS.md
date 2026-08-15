# TODO_AGENTS

## Priority 5


## Priority 4

- [Spike & plan rotation unreachable with a standing backlog](tickets/2026-07-31_spike-plan-blocked-by-queue.md) — implement the ticket's preferred option (a): when the drain routine is switched off, fall through to the rotation instead of standing down (`auto-pm.ts:134`, `auto-pm.ts:676`). Directly supports the P9 autonomy goal (#1334).

## Priority 3

- [readZip leaks onto the public API](tickets/2026-07-21_readzip-leaks-onto-public-api.md) — mark `readZip`/`ZipEntry` `@internal` in `packages/the-framework/src/driver/actions-zip.ts` (unconditional), and drop the `driver/index.ts` re-export if the first npm publish (#746) hasn't shipped yet.
- [Remove the useless 'Default' option from the model picker](tickets/2026-07-25_bug-cannot-select-fable.md) — the original "can't select Fable" bug is fixed; only the Default-entry removal remains. Handle existing configs storing "Default" with a sensible fallback.

## Priority 2

- [Show daily quota consumption as percent](tickets/2026-07-29_show-daily-quota-percent.md) — in the Usage panel, additionally show pro-rata quota time consumed and % of the pro-rata-daily quota. Filed by the maintainer as autonomous-AI fodder.
- [Empty dropdown at the bottom of Settings](tickets/2026-07-25_empty-settings-dropdown.md) — locate the control; if it's dead markup remove it, if it's an unfinished feature don't render it while empty.
- [Agent escaped run worktree — fix 2 only](tickets/2026-07-27_agent-escaped-run-worktree.md) — scoped strictly to the ticket's fix 2: add the workspace-boundary instruction to the system prompt ("cheap and worth doing regardless"). Fixes 1 and 3 are NOT queued (design choice pending).
