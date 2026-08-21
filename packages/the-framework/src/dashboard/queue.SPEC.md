The cross-project view of the AI work queue: every project's open TODO entries rolled up in one place, most-loaded project first.

## User Stories

- The user sees how much queued AI work each project has, heaviest first.
- The user can trust the count: the card counts exactly what the automatic sweep would drain.

## Flows

- What counts as an entry deliberately matches the sweep that drains the queue — otherwise the card could say "nothing queued" while the sweep works the same file.
- Any list item is an open entry unless its checkbox is checked; link-style entries without a checkbox count as open too.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
