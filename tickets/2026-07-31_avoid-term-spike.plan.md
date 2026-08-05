Effort: 1
Uncertainty: 2

# [Plan] Avoid term "Spike"

Complete inventory of where "spike" reaches users, with a concrete replacement per site; internal identifiers deliberately stay.

## TLDR

Eight strings actually reach users; everything else that greps for "spike" is internal (identifiers, comments, tests, changelogs, the `spike/` dev directory) and stays, per the ticket's "sparing use is fine where context makes it okay". The routine label becomes the ticket's own suggestion, "Plan tickets (aka spike)". No data migration: the persisted preset id `spike-and-plan` is kept on purpose. Small enough for one autonomous session; `TODO_AGENTS.md` already carries the implementation entry.

## Rename — user-facing sites

| # | Site | Current | Proposed |
|---|------|---------|----------|
| 1 | `packages/the-framework/src/preset-catalog.ts:102` (label; shown in the presets menu and as run/routine label) | `Spike & plan tickets` | `Plan tickets (aka spike)` |
| 2 | `packages/the-framework/src/auto-pm.ts:281` (`describe`; the routine status line via `doing()`) | `spiking & planning "<ticket>"` | `planning "<ticket>"` |
| 3 | `packages/the-framework/src/auto-pm.ts:752` (rotation note shown in the dashboard) | `every open ticket already has a spike or plan, or an agent on the way to one` | `every open ticket already has a plan, or an agent on the way to one` |
| 4 | `packages/the-framework/src/auto-pm.ts:761` (fan-out agent id; user-visible as `CLAIMED: spike-1-0` in `.lock.md` and "· spike-1-0" on the ticket detail page) | `spike-<t>-<i>` | `plan-<t>-<i>` |
| 5 | `packages/the-framework/src/auto-pm.ts:275` (pin appended to the fan-out prompt; prompts are inspectable in run views) | `spike & plan exactly one ticket` | `plan exactly one ticket` |
| 6 | `packages/framework-dashboard/components/OnboardingChecklist.tsx:146` (onboarding copy) | `The agent plans and spikes from them` | `The agent researches and plans them` |
| 7 | `packages/the-framework.ai/pages/index/AutonomousAi.tsx:59` (website) | `Spike, plan, and prioritize your tickets` | `Research, plan, and prioritize your tickets` |
| 8 | `packages/the-framework/prompts/ticketing_format.md:76–77` (in every agent's system prompt; shapes agent-written plans users read) | `spiking` ×2 | line 76: `early research (aka spiking — high-level findings without an implementation plan)`; line 77: `transitioning from research to concrete plan` |

Notes on #4: the id is opaque — it is only ever compared by string equality against the `CLAIMED:` line the daemon itself wrote (stale-claim check in `pinnedSpikeJob`'s prompt, lock matching in `ticket-locks.ts`), never parsed by prefix. Changing the prefix affects new runs only; locks already committed keep matching their own runs. No compatibility concern.

`prompts.generated.ts` is not committed — `gen:prompts` runs automatically on build/typecheck/test, so editing `ticketing_format.md` is the whole change for #8.

## Keep as-is (and why)

- **Preset id `name: 'spike-and-plan'`** (`preset-catalog.ts:102`): it is the persisted key for the per-routine on/off switches (#1209, `AutoPmJob.name`) and the asserted id list (`preset-catalog.test.ts:41`, `auto-pm.test.ts:251`). It is an identifier, not wording; renaming it would silently re-enable the routine for anyone who switched it off. Rejected alternative: rename plus a settings migration — not worth it for a wording ticket.
- **Internal code identifiers**: `spikeAndPlan`, `SpikeAssignment`, `spikeCandidates`, `lockSpikes`, `pinnedSpikeJob`, `PRESETS_SPIKE_AND_PLAN`, the `prompts/presets/spike_and_plan.md` filename. Developer-facing only. Optional follow-up: a mechanical rename sweep; keeping the diff small and reviewable wins for now.
- **Comments, test names, `CHANGELOG.md`s, `.changeset/*`** — developer-facing or historical records.
- **`spike/` root directory** — dev artifacts (the cc-web-extension spike), not product surface.
- **`tickets/*` filenames and bodies** (e.g. `2026-07-31_spike-plan-blocked-by-queue.md`), `TODO_AGENTS.md` entries — internal work items in this repo, not the product.

## Optional (cheap, recommended)

- `packages/the-framework/VISION.md:12` `Spike & Plan` → `Plan tickets (aka spike)` — maintainer roadmap in a public repo; aligns with the new label.
- `packages/framework-dashboard/package.json:5` and `README.md:1,3` — here "spike" means "this package is a de-risking prototype" (a different sense), but the package description is public on npm: `(spike)` → `(prototype)` reads better for everyone. Skip if the maintainer wants to keep XP vocabulary for dev-facing packaging.

## Decisions (veto cheaply here)

1. **Replacement vocabulary** — recommended: "plan" wherever the artifact is the `.plan.md` (sites 1–5), "research" for the exploratory sense (sites 6–8), keeping exactly one "(aka spike)" / "(aka spiking)" parenthetical in the label and the ticketing format, as the ticket itself suggests. Alternatives: "explore"/"de-risk" (less plain), dropping the parentheticals entirely (loses the bridge for users who do know the term).
2. **Touch internal identifiers now?** — recommended: no (see above). Alternative: full sweep in the same PR.

## Implementation

1. Apply the eight renames above, plus the two optional ones unless vetoed.
2. Update tests that pin the old strings: `auto-pm.test.ts:885` (`/already has a spike or plan/`) and the `pinnedSpikeJob` assertions around `auto-pm.test.ts:891` (pin text, describe, `spike-7-0` fixture); for fixture consistency also `TicketDetailPage.test.tsx:115/120/133` and `control.telefunc.test.ts:98` (`spike-1-0` → `plan-1-0`). Ids in `preset-catalog.test.ts:41` / `auto-pm.test.ts:251` stay unchanged.
3. `pnpm -r test` (regenerates prompts and runs the assertions).
4. Acceptance check: grep the user-visible surfaces — string literals in `preset-catalog.ts`/`auto-pm.ts`, `framework-dashboard/components/*.tsx`, `the-framework.ai/pages/`, `prompts/**/*.md` — and confirm "spike" survives only inside the sanctioned "(aka …)" parentheticals (comments and tests aside).

Implementation is already queued: `TODO_AGENTS.md` Priority 9, "Stop using the term \"Spike\" in user-facing wording" — that entry can now execute against this plan. Per the ticket, it should be picked up autonomously (dogfooding #1334).
