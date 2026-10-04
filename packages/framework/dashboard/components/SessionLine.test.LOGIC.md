What the tests cover, for the "Session set up" line (`SessionLine.tsx`):

- **Folded** - it is one line, a button reading "Session set up", showing none of the facts.
- **Opened** - it says, in order, the checkout's folder, the branch, and the coding agent with its model by the name the coding agent lists it under; a second click removes the box.
- **Started from another branch** - a card that names the branch the agent was told to start from adds one line under the branch: "Started from the branch my/work, not from the main branch."; a card that names none has no such line.
- **A fact not known** - a card that says only the coding agent shows that one line, the coding agent named alone when the card says no model.
- **Nothing known** - a card that says none of them draws nothing.
