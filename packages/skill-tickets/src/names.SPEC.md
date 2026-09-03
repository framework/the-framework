The names everything in the package hangs off, and the small rules that tie a ticket to its siblings, to the queue and to the issue it tracks. Pure text rules, reachable on their own by code that runs in a browser and must not pull in git.

## Business logic — TL;DR

- **Where the tickets live, by name** - the shared data branch `agent-data` (named by `@gemstack/agent-data`, not here), its persistent checkout `.branches/agent-data`, the `tickets/` folder inside the branch, the queue file `TODO_AGENTS.md` beside it, and the `meta.json` stamp inside the folder. Conventions, not settings: `SKILL.md` names the same ones to every agent.
- **A ticket names its own siblings** - a ticket's plan and its claim are `<STEM>.plan.md` and `<STEM>.lock.md` beside it, derived from the ticket's filename, so nothing has to record the pairing.
- **The gate for a filename from outside** - what counts as a ticket filename, and what counts as a ticket path.
- **The ticket a queue entry came from** - read back off the entry's own markdown link.
- **The queue section a ticket earns** - a ticket's `Priority:` mapped onto the queue's numbered sections.
- **The issue a ticket tracks** - read off its `GitHub:` header line.

## Business logic

### Where the tickets live, by name

#### User story

- An agent, a person and a caller all look for the tickets in the same place, without being configured.

#### Business logic

The tickets and the queue live on the git branch `agent-data` of the project's own repository — the shared data branch every skill keeps its files on, whose name `@gemstack/agent-data` exports. A long-lived process keeps that branch checked out at `.branches/agent-data`, beside the agent checkouts. On the branch, `tickets/` holds the tickets, their plans, their claims and `meta.json`; `TODO_AGENTS.md` sits beside that folder at the branch root. `tickets` is also the name of the link the repository root gets into the checkout (`store`), so a person browsing the project finds the tickets one listing away.

`tickets/` holds only open tickets: closing one deletes it with its siblings. `meta.json` records when the tickets last caught up with an issue tracker.

### A ticket names its own siblings

#### Business logic

A ticket is `tickets/<DATE>_<SLUG>.md`. Its plan is `<DATE>_<SLUG>.plan.md` and its claim is `<DATE>_<SLUG>.lock.md`, both beside it, both derived from the ticket's filename with the `.md` dropped. A file whose name ends in `.plan.md` or `.lock.md` is written *about* a ticket and is never a ticket itself — which is the one rule every listing, every gate and every close uses to tell the two apart.

### The gate for a filename from outside

#### User story

- A filename reaches the package from a command's argument, from a queue entry or from a browser, and must never address a file outside the tickets folder.

#### Business logic

A ticket filename is a `.md` name with no path segment at all, and not one of a ticket's own siblings: a relative segment, a nested path, an absolute path and a `.plan.md`/`.lock.md` name are all refused. A ticket path is the same thing spelled out: `tickets/<name>.md`, and nothing else — a segment that climbs out, a deeper nesting, a dotfile, a URL and a non-markdown file all fail it.

#### Rationale

One gate, used at both ends: what a queue entry is allowed to be read as, and what a caller is allowed to record. A traversal dressed as a markdown link is refused by the same rule that refuses it as a command argument.

### The ticket a queue entry came from

#### Business logic

Queueing a ticket writes the entry as a markdown link back to the ticket, so the identity is on the line itself and nothing has to be stored elsewhere. Reading an entry gives the ticket's `tickets/<file>` path when the entry links to one, and nothing when the entry is just text — work with no ticket behind it. Only a link that stays inside the tickets folder counts.

### The queue section a ticket earns

#### User story

- A ticket is put on the queue and lands where its own priority says it belongs.

#### Business logic

A ticket's `Priority:` key and the queue's `## Priority N` sections are the same 0–10 scale, taken at its word. A ticket with no priority, a priority written as a word, or one out of range or fractional lands in the middle, 5.

#### Rationale

Guessing a plausible number would hide the typo, and clamping would claim one of the scale's reserved ends: 10 is for critical work to act on immediately and 0 is an only-if-capacity decision, neither of which a translation should make on the writer's behalf.

### The issue a ticket tracks

#### Business logic

A ticket may carry a `GitHub: [#42](…/issues/42)` header line. The issue it tracks is read from that line as a `#42` reference: the number comes from the URL when there is one — the label is display text, the URL is the identity — and from the label itself for a line written by hand with no URL. A ticket with no such line, or one whose line names no number, tracks no issue.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
