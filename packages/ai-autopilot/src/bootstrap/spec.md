The bootstrap spine: take an app from nothing to production-grade — scope → build → checklist/improve loop → deploy — over injectable steps.

## TLDR

- Only `scope` and `build` are required steps. The checklist runs only for a full-scope build; `improve` is skipped on the final pass (so with one pass it never runs). Production-grade is defined as "at least one checklist pass ran and its blockers were empty" — a prototype or checklist-less run is *never* production-grade, by construction.
- `serve-check.ts` is the checklist with teeth: install → build → start the dev server → wait for the port → fetch a health path — racing the fetch against process exit (a server that crashed on boot reports its exit code and log tail) and bounding it with a timeout (a wedged server would otherwise hang the pass loop forever). Checklists compose by merging: blockers union, notes join.
- `deploy.ts` separates deciding from executing: the module decides render mode and target (structured output, then **re-normalized against the allowed values** so a hallucinated target can never reach an adapter); a `DeployTarget` adapter executes. The default target is plan-only — nothing blind-deploys.

## Decisions

- The abort signal is checked only *between* phases — the supervisor has no native abort, so mid-build interruption is not supported.
- A checklist prompt that returns no parseable verdict is converted into an explicit blocker — "the prompt ran but said nothing" cannot pass.
- A runner without process-start/preview capability makes the serve check **skip with a note** (a passing verdict) rather than block forever — a skipped check is distinguishable from a passing one only by that note, a documented trade-off.
- Both real deploy targets (Cloudflare: wrangler inside the session, Workers for SSR / Pages otherwise; Dokploy: one deploy API call — it builds from its own git source) never throw: a missing token or failed build returns a not-deployed result, so a successfully built app is never lost to a deploy crash.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
