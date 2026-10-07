The project home [1]: a project's own page, laid out as the agent view [5] is. The bar with the "⋮" menu of actions on the project and the daemon's current complaint about the project are at the top. Under them, an overview of the project's agents [3] and the open questions [4] (every project's, or only the picked project's when one is picked in the sidebar's project select) fill the page from the top, in a centred column of the chat's width, and scroll there. The launcher [2] is at the bottom of the page, outside what scrolls, in the place and at the width of an agent's message box. The project's `PLAN`/`TODO` documents are not in this column: they are the right rail's "Docs" tab (`RightRail.tsx`). The page is never taken over by an agent: starting one adds the agent to the rail and opens its agent view [5] alongside, while this page stays put so the user can launch again.

## Glossary

[1] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used to say something to an agent).
[2] launcher: the Start form on a project's own page.
[3] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[4] open question: a question nobody has answered yet, as the dashboard lists them across projects.
[5] agent view: one agent's page.
[6] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[7] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root. The agent can still reach everything; the Context only says where to look.

## Business logic — TL;DR

- **The project's actions first** (`ProjectActions.tsx`) - the bar at the top holds the "⋮" menu of actions on the project itself and nothing else, laid out as the action bar at the top of the agent view [5] is. It does not name the project: the launcher's [2] chip does. The page hands the bar what the dashboard wants told once the user removes the project from that menu, so the dashboard can leave the page (`App.tsx`).
- **The error banner at the top** (`ProjectErrorBanner.tsx`) - what the daemon currently finds wrong with the project is shown above everything else on the page, so nobody starts an agent [3] on a project whose `agent-data` branch [6] cannot reach the remote without seeing it: such an agent would work from stale tickets and fill a queue nobody else will see.
- **The agents overview** (`AgentOverview.tsx`) - shown only when the project has events to build it from.
- **Open questions** (`OpenQuestions.tsx`) - the agents that wait on an open question [4] across all projects, one row each; a row opens its agent, where the question is answered, and may switch to another project's agent. With a project picked in the sidebar's project select, only that project's questions show.
- **The launcher** (`StartAgentForm.tsx`) - at the bottom of the page, where it stays while the rows above it scroll: the Start form, given the project's name for its chip above the box, the project's file list for the `#` picker and the Context [7] with its edits, which the shell owns and shares with the right rail's file tree; the id of a started agent is carried up to the shell so it can land on that agent.
