Every session's open question, answerable in one place on the launcher (#1455 item 4 + bonuses 1/2) — one big view with its own scroll area and a jump-nav on the right, no pagination (the #299 shape). Before, each question lived inside its own session view and the Overview badge only counted them.

## TLDR

- Polls `onOpenQuestions` (5s): every project's parked runs with their FULL gate (options, multi, recommended), longest-waiting first — built server-side from each run's event log, because `RunMeta.pendingChoice` carries only id and title.
- One card per question: a header naming the session (name → intent's first line → run id) and its project, clicking it jumps into that session (`onOpenSession(projectId, runId)` — possibly another project's); below it the same `ChoicePanel` the session's rail renders, so answering here IS answering there (`sendChoice` against the question's own project and run).
- Bonus 1: the cards scroll inside their own area (`max-h-[70vh]` on the ScrollArea viewport — the Root cannot cap, see scroll-area.tsx); beside it, when there is more than one card, a right-hand jump-nav (one row per card, `scrollIntoView` on click) that holds still while the cards scroll. Pagination is explicitly rejected (Claude Code web's prev/next is the anti-pattern).
- Bonus 2: a question answered HERE collapses to a single ✓ line (`AnsweredCard`) and stays — expanding shows the options with the pick marked, plus an Open-session link. The memory is per-mount (`answered` map keyed like the cards), fed by `ChoicePanel.onAnswered`; answered gates the poll still carries render collapsed in place, ones the poll dropped append after the open cards. A reload starts clean.
- The section header counts only the OPEN questions; renders nothing while empty (and nothing answered) or unloaded: an empty "Waiting on you" on every launch is noise.

## Decisions

- `ChoicePanel` mounts with `countdown={false}`: the hub renders every parked gate at once, and a page that auto-accepts them all ten seconds after opening is a mass auto-accept, not a hub. The session's own rail keeps the countdown — there the user chose to look at that one run.
- Cards are keyed on project + run + gate id, so a re-fired gate remounts its panel with fresh state (ChoicePanel's caller contract) — and lands as a fresh OPEN card even if an earlier firing was answered here.
- Cross-project on purpose: "every session in one place" is the ask, and the badge it upgrades (`interventionCount`) is cross-project too.
- Answered cards persist by local bookkeeping rather than server state on purpose: the poll dropping a resolved gate would otherwise yank the card from under the cursor, and "what did I just decide" is a question the launcher should still answer.
