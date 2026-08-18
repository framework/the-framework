Surfaces the plan and backlog documents at a project's root so the human can read them in the dashboard beside the agent.

## TLDR

- Plans come before backlogs, with each category's flat file first and its per-agent variants after; anything else at the root is ignored.
- Filenames come from listing the directory and matching fixed patterns — never from the client — so nothing can escape the workspace.
- Missing, blank, or unreadable files are skipped and a runaway file is truncated; the read never fails the page.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
