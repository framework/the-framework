Every preset in one table: the `presets` record maps a key to a `definePreset` row (name, template, `what` param meaning, launcher label, tooltip, newSession flag), plus the launcher's ordered list and queue-drain detection.

## TLDR

- Quality presets with a `what` param: `research` (#331, direct-prompt with live `<AWAIT>` gates), `maintainability` (#361, deliberately minimal), `readability` (#360), `securityAudit` (#461), `ux` (#962, unattended — ends in work not `<AWAIT>`), `maintenance` (#881/#882, the periodic codebase sweep).
- Paramless presets (scope themselves to the repo's tickets/plans/queue): `marketResearch` (#694), `importTickets` (#959, newSession), `updateTickets` (#1208, newSession, resumes from `tickets/meta.json` `lastImportedAt` and reconciles), `spikeAndPlan` (#685), `suggestNewTickets` (#462/#683), `suggestNewFeatures` (#1109, autonomous), `suggestTicketsToWorkOn` (#698, gated — ends in `<AWAIT>`), `drainQueue` (#855, daemon-only), `triageQuick`/`triageConsensual` (#891/#892, refill the queue from `tickets/*.md` split by cost).
- `drainsQueue(prompt)` (#1117): recognizes a hand-started run as the queue-drainer by exact match against the rendered `drainQueue` preset.
- `LAUNCHER_PRESETS`: the user-facing presets in display order; `drainQueue` is absent because only the daemon fires it.
- Pure by construction (no `node:*`) so the dashboard renders any preset in the browser (#520); prompt text ships in `prompts/presets/<stem>.md` and arrives via generated constants.

## Decisions

- One table replaced 14 single-`definePreset` files (56 exported names for 14 objects with copied doc comments): what actually varies is two or three values, which is what a row is.
- `LAUNCHER_PRESETS` is a list rather than a `launcher: true` flag per row: membership and order are the same decision, and the list doubles as the answer to "which presets are user-facing".
- `drainsQueue` compares against the *rendered* preset, not a copy of its words, so rewording the preset cannot leave it behind (drift would only show as an Overview lane quietly staying empty); deliberately exact — a prompt merely mentioning the queue is not a drain.
- `suggestTicketsToWorkOn` is deliberately kept out of the auto-PM job rotation: it ends in `<AWAIT>`, so firing it unattended would wedge a run against a human who is not there.
- `importTickets`/`updateTickets` are `newSession`: importing is repo work, not a reply, so it opens its own session instead of appending to whichever one the user is reading.
- The triage pair splits on cost only (both are consensual: zero open questions/variability) so the rotation can queue cheap and significant batches on separate turns.
- `updateTickets` reads the import timestamp out of the repo rather than having it rendered into the prompt: the stamp travels in the same commit as the tickets it describes, so a run whose work never landed cannot leave a false claim behind.

## Facts

- `${{ }}` fragments cannot nest (the scanner stops at the first `}}`) — why `maintenance`'s target is a plain blank and `marketResearch` defines `<SESSION_NAME>` itself (launched from the launcher, where no session exists yet).
- `triageQuick`/`triageConsensual` prompts pin their own `<SESSION_NAME>` and abort when `the-framework/<SESSION_NAME>` already exists — the collision guard that makes them safe to fire on a schedule (an in-flight triage owns the branch, so the next firing no-ops).
