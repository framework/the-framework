The browser's typed stub behind the usage panel: where the account's quota [1] stands against the quota boundary [2]. It is addressed by the call's name over the dashboard's transport (`lib/rpc.ts`) and declared with the daemon's own signature for it, taken from `src/dashboard-rpc/quota.ts`; a call the daemon renames, or whose answer changes shape, therefore fails the dashboard's type check instead of breaking the panel at runtime. The stub adds no rule of its own: what the call answers is the daemon's logic in `src/dashboard-rpc/quota.ts`; only the call's name and types cross into the dashboard, and none of the daemon's code reaches the browser bundle.

## Glossary

[1] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.

## Business logic — TL;DR

- **Typed against the daemon** - the stub's answer is the daemon's own for that call, so a call renamed or re-shaped on the daemon's side is a type error in the dashboard's build, never a panel that fails in the browser; the daemon's implementation is imported for its types only and stays out of the bundle.
- **The quota reading** - the account's quota [1] windows as the coding agent [3] last reported them, when the reading was taken, why the newest attempt failed when it did (the last good reading is kept through a blip and marked stale), and where the account stands against the quota boundary [2]; when the daemon has no reading at all the answer is no windows and a failure reason, never zeros that would read as "nothing used".
