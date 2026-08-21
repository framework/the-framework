Surfaces the plan documents at a project's root and the backlog off the framework's data branch (`tf-data`), so the user can read them in the dashboard beside the agent.

## User Stories

- The user reads the agents' plan and backlog documents in the dashboard's docs rail, beside the agent they belong to.

## Flows

- Plans come before backlogs, with each category's flat file first and its per-agent variants after; anything else at the root is ignored.
- Filenames come from listing the directory and matching fixed patterns — never from the client — so nothing can escape the workspace.
- Missing, blank, or unreadable files are skipped and a runaway file is truncated; the read never fails the page.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
