What the Files module adds to the dashboard, as its `./dashboard` export declares it: one side-rail tab, labeled "Files", with the tooltip "The project’s files, or a session’s with what it changed, for as long as its checkout, branch or merge commit exists — hover one to preview it, click one to add it to the next run’s Context.", counting on its label the Context's [1] files, and drawn by the tree (`FileTree.tsx`); and an agent's page's two run slots [2], the count of changed files as the summary and their list as the details (`AgentChanges.tsx`). Its stylesheet is linked with it.

## Glossary

[1] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root.
[2] run slot: a place on an agent's page a module fills: the summary, a few words in the action bar, shown until the agent has ended and its branch has been read (the handoff's own words take over then); and the details, a block under the bar. Each is told the agent, whether it is still working, and whether the bar is open.
