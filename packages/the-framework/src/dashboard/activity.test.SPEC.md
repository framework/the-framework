What the tests cover: building the "new activity" feed — a running agent maps to a `started` item and a terminal one to `finished`, carrying the terminal status so a stopped agent reads differently from a completed one; one item per agent across a project's history, ordered newest first; each project capped at its 20 most recent agents; a project whose agents cannot be read contributes nothing and is not reported as read whole, while a project with no agents at all still counts as read whole; and an agent's start and finish carry distinct identities so each transition can announce separately.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
