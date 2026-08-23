Defines what makes two watched items the same item, for both notification feeds — the interventions list and the activity feed — so each thing is announced exactly once.

An intervention about an open pull request is identified by its link, which survives title edits and re-ordering. The other two kinds are identified by their project together with the thing that is waiting: the gate an agent is parked at, or the agent whose branch holds unpushed commits — their link is the dashboard's own address, shared by all of them, and would otherwise make them collide.

An activity item is identified by its kind, its project and its agent, so one agent starting and later finishing are two separate announcements, each firing once.

## Rationale

These identities are what the daemon deduplicates on, and the dashboard applies the same rule in the browser. Keeping one definition rather than two copies matters more than usual here: a copy that drifted would silently double-notify or silently never notify, with nothing to catch it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
