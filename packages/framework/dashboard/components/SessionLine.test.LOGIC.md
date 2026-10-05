What the tests cover, for the session line (`SessionLine.tsx`):

- **Folded** - it is one line, a button reading "Session set up", showing none of the facts.
- **Opened** - it says, in order, "Made the checkout" with the checkout's folder, "Made the branch" with the branch, and "Started Claude Code" with its model by the name the coding agent lists it under, a green check in front of each of the three; a second click removes the box.
- **Started from another branch** - a card that names the branch the agent was told to start from adds one line under the branch: "Started from the branch my/work, not from the main branch."; a card that names none has no such line.
- **A fact not known** - a card that says only the coding agent shows that one line, "Started Codex", the coding agent named alone when the card says no model.
- **Nothing known** - a card that says none of them draws nothing.
- **While the session is being set up** - it is one moving line with the seconds since the given moment, and no button: "Starting session" while the card says nothing, "Making the checkout" once the card names the coding agent, "Starting Claude Code" once the card also names the branch; once set up it is the folded "Session set up" button and no moving line.
- **No time to count from** - the moving line shows its step and no seconds.
- **An agent that runs elsewhere** - with the coding agent named and no branch, its moving line still reads "Starting session", never "Making the checkout".
