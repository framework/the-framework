The browser's typed stubs behind the usage panel: where the account's quota [1] stands against the quota boundary [2], what Auto PM [3] last decided, and running an Auto PM sweep [4] now. One stub per call, addressed by the call's name over the dashboard's transport (`lib/rpc.ts`) and declared with the daemon's own signature for it, taken from `src/dashboard-rpc/quota.ts`; a call the daemon renames, or whose arguments or answer change shape, therefore fails the dashboard's type check instead of breaking the panel at runtime. The stubs add no rule of their own: what each call answers is the daemon's logic in `src/dashboard-rpc/quota.ts`; only the calls' names and types cross into the dashboard, and none of the daemon's code reaches the browser bundle.

## Glossary

[1] quota: The account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] quota boundary: The share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[3] Auto PM: The daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[4] sweep: A background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[5] coding agent: The CLI doing the actual work: Claude Code or Codex.
[6] preferences: The user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[7] routine: A preset the daemon fires on its own on a schedule — update tickets, triage quick, triage consensual, plan tickets, maintenance — each switchable off and runnable on demand.
[8] drain: Starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.
[9] fan-out: Starting several agents at once, one per queue entry or one per ticket to plan.
[10] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.

## Business logic — TL;DR

- **Typed against the daemon** - each stub's arguments and answer are the daemon's own for that call, so a call renamed or re-shaped on the daemon's side is a type error in the dashboard's build, never a panel that fails in the browser; the daemon's implementation is imported for its types only and stays out of the bundle.
- **The quota reading** - the account's quota [1] windows as the coding agent [5] last reported them, when the reading was taken, why the newest attempt failed when it did (the last good reading is kept through a blip and marked stale), and where the account stands against the quota boundary [2]; when the daemon has no reading at all the answer is no windows and a failure reason, never zeros that would read as "nothing used".
- **What Auto PM last decided** - whether Auto PM [3] was on at its last sweep [4], when that sweep ended, when the next is due, and one line per project saying what was started or why it stood down; nothing before the first sweep, which the panel reads as "nothing to say" rather than as an idle sweep.
- **Run the sweep now** - an Auto PM sweep fired on demand and awaited, answering its outcomes one line per project, or that the sweep itself failed. The Auto PM preference [6] does not gate it: that preference is consent to spend quota unasked, and this call is asking, so the sweep runs once even with Auto PM off, every other stand-down reason still in force. It can be narrowed to one routine's [7] work, `drain` [8] fanning out [9] one agent per entry of the agent queue [10], `plan` one per open ticket, or the routine pinned to one branch, and to one project.
