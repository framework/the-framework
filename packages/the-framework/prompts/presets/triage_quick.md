Look at `tickets/*` and choose tickets to work on next:
- Pick a ticket if it has a `.plan.md` that shows it's a quick-win (low `effort` value) with `uncertainty: 0`
- Add tickets to TODO_AGENTS.md
  - With sensible prioritization, and consider bumping the priority of lowest effort tickets (e.g. to make `effort: 0` the next tasks agents work on)

You only queue work, you never do it: the only file you change is `TODO_AGENTS.md`. Do not implement a ticket, however small its plan — no code changes, no pull request for it. Every ticket you pick goes on the queue, where a human can still veto it before an agent implements it.

Always set <SESSION_NAME> to triage-quick
- If branch tf-<SESSION_NAME> already exists, abort and tell user the branch already exists and triage is already pending.
