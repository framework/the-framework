The dashboard's handles for every read it makes of the daemon: everything the pages render that is not the live event stream.

Each handle is declared against the daemon's own implementation of that read, so a rename or a changed shape breaks the dashboard at build time instead of failing as a missing route once a user opens the page.

## Business logic — TL;DR

- **Agents** - a project's agents and their status records, one agent's full event log, its worktree, the worktrees kept after the agent finished, and where a finished agent's work ended up (branch, pull request, merge).
- **Cross-project pooling** - the Overview's feeds gathered across every project at once: recent agents, hot tickets, interventions ("needs you"), open questions (every live agent's pending gate), and the activity feed.
- **Tickets and the agent queue** - a project's tickets, one ticket's detail, ticket counts, all projects' tickets pooled, and the agent queue.
- **Code review** - the files an agent touched, their git status, one file's diff, one file's content, and the project's overall git status, all readable either against the project itself or against a given agent's worktree.
- **Project context** - the project's documents, its GitHub URL, and the user's own system prompt addition.
- **The Claude web bridge** - a cloud session's parked question, its confirmed answer, its events, whether the browser extension is connected, and the token the extension pairs with.
- **The dashboard snapshot** - the combined read the dashboard opens with.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
