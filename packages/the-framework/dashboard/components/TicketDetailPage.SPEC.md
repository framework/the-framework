One ticket's own page: its full markdown and every known fact, plus the Queue action and the manual release of a claim.

## Flows

- The user reaches the page by the ticket's filename — the same one the list row and the route carry; a deleted or mistyped ticket says "does not exist" rather than rendering blank.
- Queue files the ticket into the AI queue (`TODO_AGENTS.md`) with its priority; once queued it reads so and cannot be pressed twice, while a failed write surfaces and leaves it pressable.
- Nothing times a claim out, so a dead agent's claim stands until a human lifts it here: a claimed ticket names its holder inline and offers Release lock.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
