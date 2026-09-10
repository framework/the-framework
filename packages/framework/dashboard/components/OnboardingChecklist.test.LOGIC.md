What the tests cover:

- **Optional versus essential** - three steps carry the "Optional" badge; "Add a project" and "Populate the queue of AI tasks" do not, while "Populate tickets/" does.
- **Checkboxes, not radio buttons** - an open step is drawn as an empty square named "Not done", never as a circle.
- **The GitHub import lands on its agent** - "Update from GitHub" starts a prompt agent on the target project with the update-tickets preset's prompt, unattended, and then navigates with the project, the prompt and the started agent's id.
- **No agent id yet** - when the start reports no agent id, the navigation carries none, so the shell can adopt the running agent.
- **A refused start** - the refusal's reason ("already active") is shown and the user is moved nowhere.
- **Configure first** - the chevron's "Configure first, then run" opens the target project's launcher, starts nothing, and leaves the update-tickets prompt as the pending draft.
- **No project yet** - both halves of "Update from GitHub" are disabled.
