# Agent schedule

One line per command. The command is the project's `.claude/skills/<command>`. `every` is how often at most: the command is due only once that long has passed since its last recorded start. `when` is a check, run at the repository root: the command is due while the check prints a JSON value that is not empty. A line carries one or both; with both, an agent starts only when both hold. `cap` is how many runs of the command may be in flight at once, across every machine that shares this repository.

- work-queue: when `npx queue`, cap 1
- update-tickets: every 1h, when `gh issue list --limit 1 --json number --search "updated:>=$(npx tickets meta | jq -r .lastImportedAt)"`
- plan-tickets: every 6h, when `npx tickets list | jq '[.[] | select(.planned or .locked | not)]'`
- triage-quick: every 6h
- triage-consensual: every 7d
