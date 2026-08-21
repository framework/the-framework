The onboarding checklist: what a new install needs, each step shown in the state it is actually in rather than as a list to read past.

## Flows

- Every "done" derives from a real fact — a registered project, a filled AI queue (open items in `TODO_AGENTS.md`), tickets on disk, a granted notification permission, saved Discord credentials — so the user cannot tick a step by clicking it, and a step done outside the dashboard ticks itself.
- Only adding a project and filling the AI queue are essential; the rest are marked optional because nothing breaks without them.
- An undone step offers its fix on the row: register the current directory or pick one, start an unattended agent that fills `tickets/` from GitHub ("Update from GitHub" — the view lands on that agent), enable browser notifications, open the Discord setup. The queue step alone has no button: it ticks once the queue file holds open items.
- The user can dismiss the checklist on the Overview; the settings page copy is permanent — the place the dismiss button itself names for coming back.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
