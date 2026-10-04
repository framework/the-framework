The Files module's browser part: what it adds to the dashboard and the components that draw it. It adds two side-rail tabs, Changes first and then Files, and fills an agent's [1] page's two run slots [3] with the count and the list of files a working agent has changed; all of it reads through the dashboard's call to the module's own server part (`../src/server.ts`), and it uses the dashboard's own building blocks, so it looks like the rest of the page. `dashboard.css` (the module's utilities, following the dashboard's theme) and the build and test configuration carry no business logic.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root.
[3] run slot: a place on an agent's page a module fills: the summary, a few words in the bar above the message box, shown while that bar is drawn and until the agent has ended and its branch has been read (the handoff's own words take over then); and the details, a block under the action bar at the top of the page. Each is told the agent, whether it is still working, and whether the action bar is open.

## Business logic — TL;DR

- **What the module adds** (`index.tsx`) - the Changes tab, first, the Files tab, counting the Context's [2] files on its label, and the two run slots.
- **The Files tab** (`FileTree.tsx`) - the project's or an agent's files as a lazy tree, marked while the change is not merged, filtered, previewed, and picked into the Context.
- **The Changes tab** (`ChangesPanel.tsx`) - only the files that changed, an agent's kept once its work is merged or the project folder's own, as a list on the left, with the picked file's diff on the right.
- **The hover card** (`FilePreview.tsx`) - a file's diff or contents, read when it opens and kept fresh.
- **A file in a card** (`DiffView.tsx`) - a diff as colored lines and a file as numbered lines.
- **A working agent's changes** (`AgentChanges.tsx`) - the count in the bar above the message box and the list under the action bar.
- **The reads** (`reads.ts`) - the module's server reads, typed, a failed one kept from blanking what is shown.
- **The tests' fake dashboard** (`test-host.tsx`) - every service of the dashboard a spy.
