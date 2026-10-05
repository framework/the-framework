What the tests cover, for the launcher's "Auto" menu:

- **The button's text** - the button reads "Auto: Nothing", "Auto: Commit", "Auto: Publish branch", "Auto: Open PR" or "Auto: Merge on green" for the option in force; an unticked "Post-merge cleanup" box [2] adds nothing and a ticked one adds " · cleanup" ("Auto: Open PR · cleanup").
- **What the menu lists** - the heading "When the agent finishes", then the five options [1], each with its one-line description; only the option in force is marked as the current one and shows the check mark; given two options, the menu lists two.
- **Picking an option** - clicking "Merge on green" reports that option.
- **The "Post-merge cleanup" row** - it shows the tick and its description; clicking a ticked row reports off and an unticked one reports on, and the menu stays open; the row is absent when the box is not offered.
- **Tooltip and busy** - the button's tooltip reads "What the agent does by itself when it finishes.", and the button is disabled while the launcher is busy.

## Glossary

[1] publish option: one of "Nothing", "Commit", "Publish branch", "Open PR" and "Merge on green": how far an agent takes its work when it finishes.
[2] "Post-merge cleanup" box: the tick that follows an agent with a fresh one running the project's `post-merge-cleanup` command on its branch.
