Every session's open question, answerable in one place on the launcher (#1455 item 4) — before, each question lived inside its own session view and the Overview badge only counted them.

## TLDR

- Polls `onOpenQuestions` (5s): every project's parked runs with their FULL gate (options, multi, recommended), longest-waiting first — built server-side from each run's event log, because `RunMeta.pendingChoice` carries only id and title.
- One card per question: a header naming the session (name → intent's first line → run id) and its project, clicking it jumps into that session (`onOpenSession(projectId, runId)` — possibly another project's); below it the same `ChoicePanel` the session's rail renders, so answering here IS answering there (`sendChoice` against the question's own project and run).
- Renders nothing while empty or unloaded: an empty "Waiting on you" on every launch is noise.

## Decisions

- `ChoicePanel` mounts with `countdown={false}`: the hub renders every parked gate at once, and a page that auto-accepts them all ten seconds after opening is a mass auto-accept, not a hub. The session's own rail keeps the countdown — there the user chose to look at that one run.
- Cards are keyed on project + run + gate id, so a re-fired gate remounts its panel with fresh state (ChoicePanel's caller contract).
- Cross-project on purpose: "every session in one place" is the ask, and the badge it upgrades (`interventionCount`) is cross-project too.
- An answered panel clears on the next poll (the server stops listing a resolved gate) rather than by local bookkeeping.
