# Agent schedule

One line per command. The command is the project's `.claude/skills/<command>`. `every` is how often at most: the command is due only once that long has passed since its last recorded start. `when` is a check, run at the repository root: the command is due while the check prints a JSON value that is not empty. A line carries one or both; with both, an agent starts only when both hold. `cap` is how many runs of the command may be in flight at once, across every machine that shares this repository. `off` lists a command that runs only on a machine where a person switched it on (Settings → Automation, or `npx agent-scheduler switch <command> on`); every other command runs unless a person switched it off on that machine.

- work-queue: when `npx queue`, cap 1
- update-tickets: every 15m, when `{ gh issue list --limit 1 --json number --search "updated:>=$(npx tickets meta | jq -r .lastImportedAt)"; gh pr list --state merged --limit 1 --json number --search "merged:>=$(npx tickets meta | jq -r .lastImportedAt)"; } | jq -s add`
- plan-tickets: every 6h, when `npx tickets list | jq '[.[] | select(.planned or .locked | not)]'`
- triage-quick: every 6h
- triage-consensual: every 7d
- post-merge-cleanup: every 1h, when `gh pr list --state merged --limit 50 --json number,body --search "merged:>=$(npx logs --limit 200 | jq -r '[.[] | select(.intent == "/post-merge-cleanup" and .status == "done")][0].startedAt // (now - 86400 | todate)')" | jq '[.[] | select(.body | contains("Post-merge cleanup done.") | not) | .number]'`, off
