The bar at the top of the project home [1]. It holds one thing: the "⋮" menu of actions on the project (`AgentActionsMenu.tsx`), which opens the project on its git host, its folder, or in an editor, and removes the project from the dashboard's list. The menu is at the end of the row, and the row has the padding and the height of the action bar at the top of an agent's [2] page (`AgentActionBar.tsx`), with no line under it, so the menu is in the same place on both pages. The bar shows no project name, no branch, and not whether the project's checkout is clean or dirty. It asks the daemon nothing.

The menu is the same one an agent's page shows. Here it is given no agent, so it acts on the project's own checkout. The bar hands the menu what the page wants told once the project is removed (`ProjectHome.tsx`), which is what makes the menu offer "Remove project…".

## Glossary

[1] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used to say something to an agent).
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
