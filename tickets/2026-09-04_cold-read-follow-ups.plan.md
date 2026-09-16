Effort: 3
Uncertainty: 6

# [Plan] Follow-ups from the DECISIONS.md and SKILL.md cold reads

The status of each open item as of 2026-09-16 (main 9bb62321), and how to close each one.

## TLDR

The list splits three ways. Two items are mechanical and ready to build as one PR: the pack rewrite and the undocumented `release` output. Two are already fixed: the queue's order and the queue entry that `close` leaves behind are now in the SKILL.md files. Four are design picks for a person: the unranked queue entry, the reclaim push, the `node_modules` writes, and whether the flake item stays open. Build the mechanical PR first, then ask about the four picks as one comment on #1757.

## Status per item (verified against the code today)

1. **CI flake, "a run loses its worktree once its work is on the remote"** (`packages/framework/src/daemon.test.ts:316`). The test is still there. The last 15 CI runs on main all passed (09-09 to 09-16), so there is no fresh evidence of the flake. Its wait loop polls 150 × 20 ms, about 3 s, per start. Status: not reproduced. Close the item unless it fails again.
2. **Packaging, `workspace:*` in tarballs.** Still true. `skill-branches`, `skill-logs`, `skill-queue` and `skill-tickets` each depend on `"@gemstack/agent-data": "workspace:*"` (their `package.json`, `dependencies`). None of them has a `prepack` script, and CI does not pack. `pnpm pack` and `pnpm publish` rewrite `workspace:*` to the real version, but `npm pack` and `npm publish` do not. Status: open, mechanical.
3. **Undocumented behaviour.**
   - The `Source:` skip is now documented in `packages/skill-tickets/src/tickets.LOGIC.md:23,71`. The SKILL.md does not need it, because agents never write `Source:`. Status: done.
   - `release` prints the same shape as `claim` (`packages/skill-tickets/src/cli.ts:188`). `SKILL.md:53` still does not show what `release` prints. Status: open, one line.
   - The queue prints a flat array. `packages/skill-queue/SKILL.md:15` now says "the open entries, in order of work, as one JSON array", which matches the code: file order, with priority implied by the sections. Status: done.
4. **Design questions.**
   - *An unranked entry above the first `## ` section outranks Priority 10.* Still true. `parseQueueEntries` (`packages/skill-queue/src/queue.ts:17`) reads in file order. `npx queue add` never writes such an entry: without `--priority` it appends at the end, which is Priority 0 in a sectioned file (`appendQueueEntry`, `queue.ts:47`). Only a hand edit creates one. Status: design pick.
   - *The reclaim pushes whatever branch the checkout ended on.* Still true. `reclaimWorktree` (`packages/skill-branches/src/reclaim.ts:110-117`) pushes the checkout's current branch whenever `mayPush` is set, whatever the branch is called. `agent-scheduler` passes `mayPush: true` (`packages/agent-scheduler/src/run.ts:148`, `sweep.ts:56`). Only the branch deletion is limited to `agent-*` branches. Status: design pick.
   - *`close` leaves the ticket's queue entry.* This is now documented in `packages/skill-tickets/SKILL.md` (the `close` line and "Queue a ticket"): the agent runs `npx queue done` itself. The skills stay independent. Status: done, by decision.
   - *A package installed in the checkout writes into the user's `node_modules`.* Still true. `linkDependencies` (`packages/skill-branches/src/checkout.ts:52`) links the checkout's `node_modules` to the user's copy. The branches SKILL.md says "never edit them", but `npm install <pkg>` inside the checkout goes through the link. Status: design pick.

## Implementation (the mechanical PR)

1. Make the published tarballs installable with npm. Pick one:
   - (a) Add `"prepack": "node -e \"process.exit(process.env.npm_config_user_agent?.startsWith('pnpm') ? 0 : 1)\""` or similar, so that `npm pack` and `npm publish` fail loudly. Recommended: it is the smallest change, and pnpm already does the rewrite.
   - (b) Write a prepack script that rewrites `workspace:*` to `^<version of agent-data>`, and restore the file in `postpack`.
   - (c) Only document "publish with `pnpm publish`" in each package.

   Option (a) keeps one publish path and adds no rewrite code. Add a short DECISIONS.md bullet in each of the four packages, or one in `agent-data`, whichever the repo's DECISIONS.md style wants.
2. In `packages/skill-tickets/SKILL.md`, add what `release` prints: `{"ok":true,"file":…}`, or `ok:false` with `reason` `no-lock` / `not-holder`. Check the exact shape in `cli.ts:188-200` first. Update `SKILL.LOGIC.md` to match.
3. Verify: run `pnpm -C packages/skill-queue pack`, extract the tarball, and check that `package.json` has no `workspace:`. Then run `npm pack` in the same package and check that it now fails.

## Questions for a person (one comment on #1757)

- **Unranked entries.** Should `parseQueueEntries` sort entries above the first `## Priority` heading as Priority 5 (the tickets default), or keep file order and document "put nothing above the sections"?
- **Reclaim push.** Should `mayPush` push only `agent-*` branches, and keep the checkout with `not-on-remote` otherwise? Or is pushing a user's branch fine, because the checkout is under `.branches/`, which the agent was given?
- **`node_modules`.** Should the branches SKILL.md forbid `npm install <pkg>` in a checkout? Or should a checkout get its own `node_modules` when the agent installs something, at the cost of disk and time?
- **The flake.** Close it now (15 green runs), or keep it until someone runs the test in a loop?

## Considerations

- `parseQueueEntries` treats a line starting with `[x]` or `[ ]` as a task checkbox. A queue link whose label is exactly `x` or a space (`- [x](tickets/…)`) is therefore read as a done task and silently dropped. This is unlikely with real titles, but worth a test if the queue parser is touched.
- Rom owns the DECISIONS.md voice: the no-names/no-dates style, flow sections, short bullets.
- The four packages are published by hand. Nothing in CI catches a wrong tarball, so step 3 is a manual check.
