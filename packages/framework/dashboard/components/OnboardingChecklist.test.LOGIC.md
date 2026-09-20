What the tests cover:

- **Optional versus essential** - three steps carry the "Optional" badge; "Add a project" and "Populate the queue of AI tasks" do not, while "Populate tickets/" does.
- **The queue step needs a queue** - with no registered project having a queue, the step is not on the board.
- **The tickets step needs a tickets package** - with no registered project providing tickets, "Populate tickets/" is not on the board.
- **Checkboxes, not radio buttons** - an open step is drawn as an empty square named "Not done", never as a circle.
- **The GitHub import lands on its agent** - "Update from GitHub" starts an agent on the target project with the `/update-tickets` command, and then navigates with the project, the prompt and the started agent's id.
- **A refused start** - the refusal's reason ("already active") is shown and the user is moved nowhere.
- **Configure first** - the chevron's "Configure first, then run" opens the target project's launcher, starts nothing, and leaves the update-tickets prompt as the pending draft.
- **No project yet** - there is no "Update from GitHub" to press: no project provides tickets.
