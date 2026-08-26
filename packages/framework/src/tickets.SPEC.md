The repo conventions for tickets and the agent queue, and the small rules that link the two: where they live, how a ticket's priority maps onto the queue, how a queue entry names the ticket it came from, and how a ticket names the GitHub issue it tracks.

## Business logic — TL;DR

- **Two plain conventions** - tickets are `tickets/<DATE>_<SLUG>.md` files in the root `tickets/` directory (which holds only tickets), and the agent queue is the root `TODO_AGENTS.md` — human-facing files, not anything hidden under `.the-framework/`.
- **A ticket's priority maps onto the queue's numbered sections** - a ticket's own `priority:` value (0–10, taken at its word) becomes the `## Priority N` section a queued entry lands in; an unmarked ticket, a word spelling, or an out-of-range or fractional value lands in the middle (5) rather than being guessed at or clamped — inventing a plausible number would hide the typo. The scale's ends stay reserved: 10 is for critical production bugs and 0 is an only-if-capacity decision, neither of which a click should claim.
- **A queue entry names its ticket by link** - queueing a ticket writes the entry as a markdown link back to it, and reading the ticket back accepts only a link whose target is a plain ticket path; an entry linking anywhere else is plain text with no ticket behind it.
- **One wording for asking for a ticket's plan** - "create the ticket's `.plan.md` sibling", built here so every surface that asks — the plan column's agent, a queued plan entry, and the dedupe that recognizes one — carries the exact same sentence instead of copies that drift.
- **The agent that wrote a plan is found from the framework's records** - the newest agent whose ask names that plan (the plan-ask sentence, whether given directly or carried inside a queue drain's prompt) counts as its author; a plan file itself carries no marker, because an agent does not know its own session while it writes. A plan no recorded ask names has no author.
- **One gate decides what counts as a ticket path** - `tickets/<name>.md` and nothing else: no relative segments, absolute paths, URLs, dotfiles, nested directories, or non-markdown files. Both ends of the link (reading queue entries, recording a ticket on an agent) use the same gate, because the result is a path the dashboard renders and a reader opens.
- **A ticket can name the GitHub issue it tracks** - read off the ticket's `GitHub:` header line as a `#N` reference; the linked URL is the identity when present (a label that disagrees with it loses), a hand-written `#N` label is the fallback. This reference is what rides the PR title as `(fix #N)` so that merging the PR closes the issue.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
