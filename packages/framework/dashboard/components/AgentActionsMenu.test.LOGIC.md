What the tests cover, for the "⋮" menu of an agent's action bar:

- **One menu for the agent's actions** - a finished agent in a project whose git host names a page offers "Open on GitHub" (the git host's name being GitHub), "Open project folder", "Open in editor" and "Delete session" in the one menu.
- **Opening the folder addresses this agent** - the folder item asks the daemon to open the folder for this agent's id, whichever checkout that resolves to.
- **The folder item names what it opens** - a finished agent whose checkout is gone reads "Open project folder" and never "Open session's folder"; one whose checkout was kept reads "Open session's folder".
- **The resume command** - when the agent's events carry a driver session id, the id's first eight characters are visible in the menu, "Copy resume command" puts `mkdir -p '<directory>' && cd '<directory>' && claude --resume <session id>` on the clipboard, and the item then reads "Copied".
- **Nothing to copy without a driver session** - an agent that never reported a driver session offers neither "Copy resume command" nor "Copy session id".
- **Delete asks first** - "Delete session" opens "Delete this agent?" and nothing is deleted until its "Delete" button is pressed, which then deletes this agent from its project.
- **Stop for a working agent, and no merge** - a working agent offers "Stop agent" and no "Merge when finished".
- **An ended agent offers no Stop** - once the agent's end has arrived, "Stop agent" is not offered.
- **The menu for no agent** - it is named "Project actions", never "Session actions"; "Open folder" and "Open in your editor" ask the daemon to open the project itself; it offers no "Stop agent", "Remove worktree" or "Delete session" and draws no rule; a finished agent's menu with "Delete session" draws exactly one rule.
- **The editor picker** - picking a detected editor stores its command; picking "Default" clears the stored editor; a stored editor that was not detected still has its own row.
