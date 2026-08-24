Priority: 9
GitHub: [#1334](https://github.com/framework/the-framework/issues/1334)

# Goal: let TF fully *autonomously* work on quick-wins

## TLDR

Close the loop autonomously: every new ticket is planned via the routine work; if the plan finds a consensual quick-win, it's implemented and merged with zero human intervention. **Status 2026-08-21: the chain has run end to end on a live repo** — `issue → ticket → plan → triage bumped it to priority 7 → drain → PR titled (fix #1) → auto-merge → issue closed COMPLETED`, the merge landing 80 seconds after the daemon started — so the `(fix #N)` squash-merge checkbox is proven, not just built. The run also surfaced why it had never completed before: the CI watch merges a check-less PR once it outlives the window a check suite takes to attach, measured from `createdAt` — but `PR_VIEW_FIELDS` never asked `gh` for that field, so `Date.parse('') → NaN → continue`, every tick, forever. Fixed in #1616. Two more findings from the same run, both fixed: #1618 (nameless session's PR titled with the raw prompt, → #1621) and #1619 (unattended work started on a model whose weekly window was 100% spent, → #1620).

**The last open question — the model floor — is settled: skip Haiku support for now** (maintainer, 2026-08-21; to be recorded in MEMORY.md with the reason). Haiku never calls `setReadyForMerge()` (0/5; in #1612's test it emitted *no* signal blocks at all with the whole protocol in its system prompt) — a tier property, not prompt wording. Neither proposed fix gets built for now: not Option A (a floor that raises explicitly below-floor models on unattended runs) nor Option B (refuse to arm the merge and downgrade the handoff to `pr`).

## Why it matters

Dogfooding — the highest-prio goal. This is the end-to-end autonomy chain: ticket → plan → (if consensual quick-win) → implementation, with zero human intervention. Every link is now proven live; notably, the #1616 bug hid because every ci-watch test injects its own PR lookup — the chain was unit-tested at every link and still couldn't complete once, which is the argument for live runs over more tests.

## Source

Imported from GitHub issue [framework/the-framework#1334](https://github.com/framework/the-framework/issues/1334), created 2026-07-28, labels: `highest-prio 🌟`, 7 comments (last folded: 2026-08-21T22:16Z).

### Notes from the GitHub thread

- Tier evidence (2026-07-31) on the `setReadyForMerge` gate (#1392): whether the signal fires is a function of the model tier, not of prompt wording. Haiku 0/5 (never signals → draft PR, merge withheld); Sonnet, Opus and Fable each 1/1 unprompted (fully autonomous merges #1405/#1407/#1428). Hence the maintainer's call above: skip Haiku support rather than build a floor or Haiku-proof the prompt.
- The plan (`tickets/2026-07-28_goal-autonomous-quick-wins.plan.md`) predates the successful end-to-end run and the Haiku decision — marked outdated.
- Small drift noticed while dogfooding: `triage_quick.md` writes `effort`/`uncertainty` lowercase (lines 2, 4) while `ticketing_format.md` defines `Effort:`/`Uncertainty:` (lines 46-47). Harmless, but the kind that makes an agent guess.
- The issue was auto-closed twice by accident earlier and reopened (plan PRs inheriting `(fix #N)`; a squash-commit body GitHub read as a closing keyword) — plan PRs should say `refs #N` instead.
- Related: #1406 (repo-side auto-merge settings) is still open; later whole-chain dogfoods continue on #1204's thread (2026-08-23: three tickets in, two merged PRs out).
