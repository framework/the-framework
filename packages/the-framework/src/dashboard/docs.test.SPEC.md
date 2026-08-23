What the tests cover: the surfaced documents come back in sidebar order, `PLAN.md` before the agent queue; the agent queue is read off the data branch, and a stale `TODO_AGENTS.md` copy in the workspace root never shadows it; per-session `PLAN_…`/`TODO_….agent.md` files are surfaced while unrelated markdown files are not, with a flat file sorting before the scoped ones in its category; missing and blank documents are skipped, and a workspace that does not exist reads as empty rather than an error; the category patterns admit only fixed root filenames and `a-z0-9-` session names, so no name can traverse out of the workspace.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
