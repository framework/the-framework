What the tests cover: the conventions the skill names, and the pure rules tying a ticket to its siblings, to the queue and to the issue it tracks.

- **The conventions** - the branch is `tickets`, its persistent checkout is `.branches/tickets`, the folder on the branch is `tickets/`, and the queue file is `TODO_AGENTS.md`.
- **The siblings** - a ticket's plan and claim are named from its stem.
- **A ticket's priority on the queue's scale** - a number 0 to 10 is taken as written, padding included; an unmarked ticket, a word, an out-of-range value and a fractional one all land in the middle rather than being guessed at or clamped.
- **The ticket behind a queue entry** - a link into `tickets/` gives the ticket; an entry that is just text gives none, and neither does a link to anything else or a traversal dressed as a link.
- **A ticket path** - only a plain markdown file directly inside `tickets/` counts; a climb out, a nested path, a dotfile, a non-markdown file, an absolute path, a URL, the queue file and the bare folder are all refused.
- **A bare ticket filename** - no path segment at all, and not a `.plan.md`, a `.lock.md` or `meta.json`.
- **The issue a ticket tracks** - read off the `GitHub:` header line, the URL winning over a label that disagrees with it, a hand-written line counting by its label, and no line or no number giving none.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
