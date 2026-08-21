The repo's ticket and queue conventions: tickets are plain markdown files in a root `tickets/` folder, the confirmed-task queue is the one root `TODO_AGENTS.md` file, and this defines how the two reference each other.

## User Stories

- The user queues a ticket into the AI queue, and the queue entry stays linked back to the ticket file.
- The user marks a ticket's priority, and queueing the ticket lands it in the queue's matching ranked section.
- The user links a ticket to a GitHub issue, and merging the ticket's work closes that issue.

## Flows

- When the user queues a ticket, the entry keeps the ticket's identity as a markdown link back to its file; only a link to a plain file directly inside the tickets folder counts — traversal, absolute paths, URLs, and nesting are all refused.
- The priority the user wrote on the ticket (0-10) maps straight onto the queue's numbered sections; anything else — words, out-of-range, fractions — lands in the middle rather than being guessed at.
- The GitHub header the user put on a ticket names the issue it tracks, which is what lets merging the work close that issue.

## Rationales

- Only a link to a plain file directly inside the tickets folder counts because the value is rendered and opened by people; an entry linking anywhere else is treated as plain text rather than followed.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
