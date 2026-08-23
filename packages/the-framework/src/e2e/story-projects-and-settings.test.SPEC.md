What the tests cover: registering a project, what the dashboard then shows for it, how settings written in the dashboard reach the agents the daemon starts, and the quota panel.

**Adding a project**

- Adding a repo activates it: the repo carries the framework's marker file afterwards, and the Projects sidebar lists it as activated at its path.
- A freshly added project answers the reads its header needs: its current branch, an empty documents rail, an empty agent history.
- Adding the same repo again adds nothing and reports that it was already activated, rather than listing it twice.
- A path that is not a repo is refused with a reason instead of failing.

**Unknown projects**

- Reads for a project id nobody registered come back empty rather than erroring, and a request to start an agent on one is refused.

**Settings reaching agents**

- Preferences patched in the dashboard are readable back immediately.
- Continuing a finished agent carries the project's resolved settings — the model chosen in preferences — into the continued agent, even though the continuation itself only sends the follow-up message.
- The continuation reopens the same agent rather than creating a second one, so the history still shows one row.
- Continuing the instant an agent finishes is accepted rather than refused: the request waits out the finishing agent's teardown instead of colliding with it.

**Quota**

- When no quota reading is available the panel is told so explicitly, never shown as an empty bar that would read as "nothing used".
- With a reading, the quota windows and the time they were read reach the panel unchanged.
- Auto PM reports nothing until its first sweep, then reports when the next sweep is due and what the last one did.
- The dashboard's sweep button reaches the daemon's Auto PM loop with the routine it named, and reports back the outcome recorded per project.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
