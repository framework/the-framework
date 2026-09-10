Fixes where tickets live on the `agent-data` branch [1] and how a ticket's plan and claim [2] are named after it, and holds the small rules every filename or queue entry [3] arriving from outside is judged by: which names may address a ticket at all, which queue entry names a ticket, which priority section a ticket earns on the agent queue [4], and which GitHub issue a ticket tracks. Nothing here touches git or disk, so the dashboard's browser code applies the same rules.

## Context

**User story**: an agent pastes a queue entry's link target (`tickets/2042-01-01_some-ticket.md`) straight into `npx tickets show`, `claim` or `close` and names the same ticket the entry does; the user queues a ticket from the dashboard and it lands in the priority section its own `Priority:` names; the daemon's drain [5] reads the queue entry back and claims that very ticket for the agent it starts; a pull request opened for a ticket closes the GitHub issue the ticket tracks.

**Problem**: a filename that comes from outside (a command's argument, a browser) could reach another directory (`../x.md`, an absolute path), a hidden file, or a ticket's own plan or claim; every reader and writer must refuse the same names, in both spellings a name has (bare, or under `tickets/`).

## Glossary

[1] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[2] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[3] queue entry: an item on the agent queue.
[4] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[5] drain: starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.
[6] sibling: a ticket's plan file (`<name>.plan.md`) or claim file (`<name>.lock.md`), written about the ticket and never a ticket of its own.

## Business logic — TL;DR

- **Where tickets live and how their siblings are named** - open tickets are `.md` files inside `tickets/` on the `agent-data` branch, each with an optional plan `<name>.plan.md` and claim `<name>.lock.md` beside it, plus one `meta.json`.
- **The bare filename gate** - a name addresses a ticket only when it ends in `.md`, has no path separator, does not start with a dot, and is not a sibling.
- **The path gate** - the path form of a ticket's name is exactly `tickets/<file>.md`, with nothing nested, hidden, relative, absolute or remote.
- **Which queue entry names a ticket** - a queue entry names a ticket only through a markdown link whose target passes the path gate; any other entry is plain text.
- **The priority a ticket earns on the queue** - a `Priority:` that is a whole number from 0 to 10 places the ticket in that section; anything else, or none, places it at 5.
- **Which issue a ticket tracks** - the `GitHub:` header line yields `#<number>`, the number taken from the link's URL first and from a bare `#<number>` in the line otherwise.

## Business logic

### Where tickets live and how their siblings are named

#### Context

See `## Context`.

#### Business logic

Tickets are the `.md` files directly inside the `tickets/` directory of the `agent-data` branch [1]; the same name, `tickets`, is the link made at the repository root by the rules in `store.ts`. The directory holds only open tickets, because closing a ticket deletes it. A ticket's name without its `.md` is its stem; its plan is `<stem>.plan.md` and its claim [2] is `<stem>.lock.md`, both siblings [6] of the ticket and never tickets themselves. The directory also holds `meta.json`, the record of when the tickets last caught up with the project's issue tracker; its content is described in `tickets.ts`.

### The bare filename gate

#### Context

**Problem**: see `## Context`.

#### Business logic

A bare name is accepted as a ticket's filename only when all of the following hold: it ends in `.md`; it contains no `/` and no `\`, so it cannot leave `tickets/`; its first character is not a dot, a slash or a backslash; and it is not a sibling [6] (`.plan.md` or `.lock.md`). So `2042-01-01_some-ticket.md` passes, while `../x.md`, `sub/x.md`, `/etc/passwd.md`, `.hidden.md`, `x.plan.md`, `x.lock.md` and `meta.json` are all refused. Whether a name is a sibling is a separate check other rules use to tell a plan or claim from a ticket when listing a directory.

### The path gate

#### Context

**Problem**: see `## Context`.

#### Business logic

A string names a ticket by path only when it starts with `tickets/` and what follows ends in `.md`, contains no further `/`, and does not start with a dot. A relative segment (`tickets/../secrets.md`), a nested file (`tickets/nested/deep.md`), a hidden file (`tickets/.hidden.md`), a non-markdown file (`tickets/notes.txt`), an absolute path, a URL, a file outside `tickets/` (`TODO_AGENTS.md`) and the bare directory (`tickets/`) all fail. The two gates refuse the same names in their two spellings: what the bare gate refuses bare, the path gate refuses under `tickets/`. This one gate serves both ends of a queue link: what a queue entry [3] is read as, and what a caller may record.

### Which queue entry names a ticket

#### Context

**User story**: see `## Context`. The package itself never reads or writes the agent queue [4]; a caller that queues a ticket writes the entry as a markdown link to the ticket with the ticket's title as the label, and the drain [5] reads the link back.

#### Business logic

The ticket a queue entry names is the target of the first markdown link in the entry (the text between `](` and `)`, containing no whitespace and no `)`), and only when that target passes the path gate; the result is the `tickets/<file>` path. An entry with no link, a link to anything else (`[docs](README.md)`), a link that tries to leave the directory (`tickets/../../etc/passwd`), or a mention of a ticket outside a link (`Create tickets/2042-01-01_x.plan.md`) names no ticket: it is work with no ticket behind it.

### The priority a ticket earns on the queue

#### Context

**Problem**: the ticket format's `Priority:` is optional and written by hand, so an unmarked, misspelled or out-of-scale value has to mean something when the ticket is queued. Guessing or clamping would hide the typo, and the ends of the scale are deliberate picks (10 is "act immediately", 0 is "only if capacity") that no translation may claim.

#### Business logic

The `Priority:` value, with surrounding whitespace removed, earns the ticket the queue section of that number when it is a whole number from 0 to 10. When the value is absent, a word (`high`), fractional (`2.5`) or out of range (`11`), the ticket earns 5, the middle of the scale.

### Which issue a ticket tracks

#### Context

**User story**: an agent working a ticket imported from GitHub opens a pull request whose body closes that issue, so the issue number has to be readable off the ticket.

#### Business logic

The first line of the ticket whose text, trimmed and lowercased, starts with `github:` is the issue line. When that line holds a parenthesized URL whose path ends in `/issues/<number>` or `/pull/<number>`, the number comes from the URL: the URL is the identity, the link's label is display text, and a label that disagrees with the URL loses (`[gh-7](…/issues/99)` yields `#99`). Without such a URL, the first `#<number>` in the line counts, so a hand-written `GitHub: #13` yields `#13`. A ticket with no issue line, or an issue line with neither (`GitHub: none yet`), tracks no issue.
