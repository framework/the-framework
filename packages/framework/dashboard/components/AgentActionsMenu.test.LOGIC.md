What the tests cover, for the "⋮" menu of an agent's action bar:

- **One menu for the agent's actions** - a finished agent in a project with a GitHub URL offers "Open on GitHub", "Open project folder", "Open in editor" and "Delete session" in the one menu.
- **Opening the folder addresses this agent** - the folder item asks the daemon to open the folder for this agent's id, whichever checkout that resolves to.
- **The folder item names what it opens** - a finished agent whose checkout is gone reads "Open project folder" and never "Open session's folder"; one whose checkout was kept reads "Open session's folder".
- **The resume command** - when the agent's events carry a driver session id, the id's first eight characters are visible in the menu, "Copy resume command" puts `mkdir -p '<directory>' && cd '<directory>' && claude --resume <session id>` on the clipboard, and the item then reads "Copied".
- **Nothing to copy without a driver session** - an agent that never reported a driver session offers neither "Copy resume command" nor "Copy session id".
- **Delete asks first** - "Delete session" opens "Delete this agent?" and nothing is deleted until its "Delete" button is pressed, which then deletes this agent from its project.
- **Stop and merge for a running agent** - a running agent offers "Stop agent" and "Merge when finished" side by side; pressing the merge arms it for this agent, as a pre-commitment that stays armed.
- **An ended agent offers neither** - once the agent's end has arrived, neither "Stop agent" nor "Merge when finished" is offered.
