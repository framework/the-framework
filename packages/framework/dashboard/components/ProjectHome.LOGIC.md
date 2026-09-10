The project home [1]: a project's own page, one scrolling column that stacks the project's actions, the daemon's current complaint about the project, the launcher [2], an overview of the project's agents [3], every open question [4] across projects, and the project's docs. The page is never taken over by an agent: starting one adds the agent to the rail and opens its agent view [5] alongside, while this page stays put so the user can launch again.

## Glossary

[1] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used for live chat).
[2] launcher: the Start form on a project's own page.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] open question: a gate nobody has answered yet, as the dashboard lists them across projects.
[5] agent view: one agent's page.
[6] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.

## Business logic — TL;DR

- **The project's actions first** (`ProjectActions.tsx`) - the row of actions on the project itself sits at the top.
- **The error banner above the launcher** (`ProjectErrorBanner.tsx`) - what the daemon currently finds wrong with the project is shown before the Start form, so nobody starts an agent [3] on a project whose `agent-data` branch [6] cannot reach the remote without seeing it: such an agent would work from stale tickets and fill a queue nobody else will see.
- **The launcher** (`StartAgentForm.tsx`) - the Start form, given the project's file list for the `#` picker and the agent's Context set with its add, remove and toggle operations; the id of a started agent is carried up to the shell so it can land on that agent.
- **The agents overview** (`AgentOverview.tsx`) - shown only when the project has events to build it from.
- **Open questions** (`OpenQuestions.tsx`) - every open question [4] across all projects, answerable here; opening one may switch to another project's agent.
- **Docs** (`ProjectDocs.tsx`) - the project's docs panel, shown in this column rather than in the right rail while this page is open.
