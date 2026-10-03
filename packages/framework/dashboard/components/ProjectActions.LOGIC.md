The action bar at the top of the project home [1]: the project's name first, since with all projects showing in the sidebar nothing else on the page says which project an agent will start in, then the project's git status on the left (`GitStatusBar.tsx`) and the "⋮" menu of actions on the right (`AgentActionsMenu.tsx`): open the project on its git host, its folder, or in an editor. Both halves are the same ones an agent's [2] page shows; here they are given no agent, so they report on and act on the project's own checkout rather than an agent's.

## Glossary

[1] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used to say something to an agent).
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
