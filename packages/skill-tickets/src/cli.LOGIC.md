The `tickets` command: the six operations an agent [1], or a person in a shell, runs from any checkout [2] of the repository over the tickets on the `agent-data` branch [3]: `list`, `show`, `put`, `close`, `claim`, `release`. Reads come off origin's copy of the branch, fetched first; each write is one commit made on a throwaway checkout of origin's tip and pushed straight to the branch; every command answers with one JSON document on stdout, one line for a person on stderr, and an exit code that says how it went.

## Context

**User story**: an agent [1] working in its own checkout [2] on a code branch lists the open tickets, shows one, claims it before planning or working it, writes a plan or an updated ticket, releases the ticket when its part is done, and closes it once the work is merged; the user can do the same from a shell. The agent's checkout holds no copy of the `agent-data` branch [3], so the command reaches the branch through origin, and what it changes is visible to every other machine at once.

**Business logic story**: the rows come from `tickets.ts`, the filename gates from `names.ts`, the claim [4] and release rules from `locks.ts`, the holder [5] from `holder.ts`; the branch reader and the detached writer, including a rejected push re-applied on origin's new tip, are the `agent-data` package's. The persistent checkout the daemon keeps (`store.ts`) is never touched by the command.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the user's checkout".
[3] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[4] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.
[5] holder: who a claim names: the agent's id when the daemon started the agent, else the branch the `tickets` command ran on.
[6] queue entry: an item on the agent queue, `TODO_AGENTS.md` on the `agent-data` branch.

## Business logic — TL;DR

- **The contract: JSON out, a line for a person, an exit code** - every command prints one JSON document on stdout; a refusal adds one line on stderr and exits 1; a command line that cannot be read prints the usage on stderr, nothing on stdout, and exits 2; anything else that fails exits 1 as `git-failed`.
- **Naming a ticket** - every command takes a ticket's bare filename or its `tickets/<file>` path; a plan's or claim's name, or any name that leaves `tickets/`, is refused as `invalid-path`, except that `put` also takes a `.plan.md` and `meta.json`.
- **Reads come off origin** - `list` and `show` fetch origin once and read its copy of the branch; with no origin the local branch is read; outside a repository every command refuses `not-a-repo`.
- **`list` and `show`** - `list` answers every open ticket's row as one JSON array; `show` answers one ticket's row and whole text, its plan's text when it has one, and its holder when the claim names one; a missing ticket is `no-ticket`.
- **Writes are one pushed commit each, on a throwaway checkout** - `put`, `close`, `claim` and `release` each make one commit on a throwaway checkout of origin's tip and push it straight to the branch; nothing lands in the caller's checkout; with no remote the write is refused as `no-remote`.
- **Who the command acts as** - `close`, `claim` and `release` act as `AGENT_ID` when it is set, else as the current branch; a checkout on no branch refuses `no-identity`.
- **`put`** - writes one whole file under `tickets/` from stdin, a ticket, a plan or `meta.json`, creating it if new and overwriting it whoever holds the ticket; never a claim.
- **`claim`** - claims the ticket to implement: a plan is not in the way, only someone else's claim is; a ticket the caller already holds is claimed again without a write; someone else's claim is refused as `claimed`, naming the holder when the claim line parses.
- **`release`** - lifts only the caller's own claim; an unclaimed ticket is `no-lock`, someone else's claim is `not-holder`.
- **`close`** - removes the ticket with its plan and claim and nothing else; refused as `not-holder` while someone else holds it; the queue entry linking the ticket stays.

## Business logic

### The contract: JSON out, a line for a person, an exit code

#### Context

**Problem**: the same output is read by two readers at once, a program parsing it (an agent, the daemon) and a person watching the shell; each needs its own channel, and the exit code has to tell a rule saying no from a broken environment.

#### Business logic

The command is `tickets <command>`; its usage names the six commands. Every command that runs prints exactly one JSON document on stdout: `list` a JSON array, every other result and every refusal an object with `ok`. A result exits 0. A refusal is a rule saying no (the ticket is someone else's, there is no such ticket): it prints `{"ok":false,"reason":…}` with the reason's details on stdout so a caller parsing the output learns why, one line on stderr so a person does, and exits 1. A malformed command line is rejected before anything else runs: an unknown command prints the usage on stderr and exits 2; an unknown flag or the wrong number of arguments (`list` takes none, every other command exactly one) prints what was wrong (such as "expected 1 argument(s), got 0") followed by the usage, nothing on stdout, and exits 2. Anything else that fails, git timing out, git missing, a corrupt repository, prints `{"ok":false,"reason":"git-failed","detail":…}` with git's own explanation as the detail, the same detail on stderr, and exits 1. Only git's own "not a git repository" is read as being outside a repository, which is a refusal, `not-a-repo`, "not inside a git repository"; every other git error stays the failure it is.

### Naming a ticket

#### Context

**User story**: a queue entry [6] links its ticket as `tickets/<file>`, and an agent pastes that link target into the command as is.

#### Business logic

Every command names a ticket by its bare filename (`2042-01-01_some-ticket.md`) or by its `tickets/<file>` path; the path form is accepted only when it passes the path gate of `names.ts`, and the name that remains must pass the bare filename gate. A name that fails, a plan's or claim's name, a relative segment (`../x.md`), a nested path, an absolute path, a non-markdown name, is refused before anything is read or written, as `invalid-path`, "<name> is not a ticket filename", the refusal naming the file as given. `put` is the one exception: after dropping a leading `tickets/`, it takes a ticket's filename, a ticket's `.plan.md` (a name that is a ticket's filename once `.plan.md` is read as `.md`), or `meta.json`, and refuses everything else, a claim file included, as `invalid-path`: "<name> is not a file under tickets/ this command writes: a ticket, its .plan.md, or meta.json".

### Reads come off origin

#### Context

**Problem**: only origin has every writer's pushes, this command's own earlier writes included, because a write never leaves a copy of the branch in the caller's checkout [2].

#### Business logic

`list` and `show` fetch origin once and read everything from origin's copy of the `agent-data` branch [3], by the `agent-data` package's reader, so a command sees what every writer pushed. With no origin, the local branch is read; writes are refused there, so nobody else can have moved it. Outside a repository, every command, reads and writes alike, refuses `not-a-repo` before touching anything.

### `list` and `show`

#### Context

See `## Context`.

#### Business logic

`list` takes no argument and answers every open ticket's row, newest first, as one JSON array, the rows being those of `tickets.ts`: file, title, summary, date, planned, and, when set, priority, topics, github, effort, uncertainty, locked and lockedBy; a plan or claim [4] beside a ticket folds into that ticket's row and is never a row of its own. `show <file>` answers `{"ok":true,"ticket":…}`, the ticket being its row plus `content`, the whole markdown; `plan`, the plan's whole text, is present only when the ticket has a plan; `holder`, the name the claim's line gives, is present only when the ticket is claimed and the line parses (a claim whose line does not parse still shows the ticket as locked, without a holder). A file that names no existing ticket refuses `no-ticket`, "no ticket tickets/<file>".

### Writes are one pushed commit each, on a throwaway checkout

#### Context

**Problem**: the caller's checkout [2] is on a code branch and must stay untouched, yet a claim [4] is worthless until every other machine can see it; and two agents can write the branch back to back, so a write must land on origin's newest tip, not on whatever was fetched a moment earlier.

#### Business logic

`put`, `close`, `claim` and `release` each make one write: a throwaway checkout of origin's tip of the `agent-data` branch [3] is made, the change applied to it, committed with the command's own message ("put tickets/<file>", "close tickets/<stem>", "claim tickets/<stem>", "release tickets/<stem>"), and pushed straight to the branch; a push origin rejects because another writer got there first is re-applied on the new tip and pushed again, by the `agent-data` package's rules. Every judgment a write command makes (does the ticket exist, who holds it) is therefore made inside the write, against the tip the commit lands on, and a re-applied write judges again. A command whose judgment is a refusal changes nothing, so nothing is committed. The commit is authored as the git user of the checkout the command ran in. Nothing lands in the caller's checkout, which keeps no copy of the branch, and the daemon's persistent checkout is never touched. A repository with no remote has nothing to carry the change: the write is refused as `no-remote`, "the repository has no remote, so nothing can carry the change".

### Who the command acts as

#### Context

**Problem**: a claim [4] has to name someone no agent [1] was ever told, and the name must still match at release time.

#### Business logic

`close`, `claim` and `release` act as the holder [5] decided by `holder.ts`: `AGENT_ID` from the environment when it is set and not blank, else the name of the branch the current directory's checkout [2] is on; the checkout's folder name means nothing. The identity is settled before the write. A checkout on no branch, with no `AGENT_ID`, refuses `no-identity`: "this checkout is on no branch, so there is nothing to claim as". `AGENT_ID` outlives a branch rename, whereas a branch name does not: a caller named by its branch must release from the branch it claimed on, or the claim stays until a person edits the branch. `put`, `list` and `show` need no identity.

### `put`

#### Context

**User story**: an agent [1] drafts a ticket or a plan in a file and writes it to the branch with `npx tickets put <file> < draft.md`; the daemon's issue import refreshes tickets the same way and stamps `meta.json`.

#### Business logic

`put <file>` reads all of stdin and writes it as the whole file `tickets/<file>`, creating the file, and `tickets/` itself, when new; empty stdin writes an empty file. The claim [4] on the ticket is ignored: whoever holds the ticket, the file is overwritten, so an import can refresh a ticket someone holds. A plan may be written for a ticket that does not exist, without complaint; such a plan is invisible to `list` and `show` until its ticket exists. The write lands as "put tickets/<file>" and answers `{"ok":true,"file":"tickets/<file>"}`. A claim file is never written this way: claims go through `claim`.

### `claim`

#### Context

**User story**: before planning or working a ticket, an agent [1] claims it and is told whether it is now its own or someone else's; on someone else's it picks another ticket and never removes or overwrites their claim [4].

#### Business logic

`claim <file>` claims the ticket to implement, by the batch rule of `locks.ts` in its "implement" side: an existing plan is not in the way, only a claim is. A ticket with no claim gets one naming the holder [5]; a ticket already claimed by this very holder is claimed again without a write and without a commit; both answer `{"ok":true,"file":"tickets/<file>","holder":…}`. A ticket that does not exist refuses `no-ticket`. A ticket someone else holds refuses `claimed`, `{"ok":false,"reason":"claimed","holder":…,"file":…}`, the holder present only when the claim's line parses (a claim naming nobody readable is still a claim), and tells the person "tickets/<file> is claimed by <holder>: pick another ticket", "someone else" standing in for an unreadable holder. A refused claim commits nothing.

### `release`

#### Context

**User story**: when the plan or the work is done, and before it stops unless it closed the ticket, an agent [1] lifts its own claim [4]; nothing lifts a claim on a timeout.

#### Business logic

`release <file>` removes the ticket's claim [4] only while it names this very holder [5], by the release rule of `locks.ts`, and answers `{"ok":true,"file":"tickets/<file>","holder":…}`. A ticket with no claim refuses `no-lock`, "tickets/<file> is not claimed". A ticket held by anyone else, or whose claim line does not parse, refuses `not-holder`, the holder named in the refusal when the line parses, and tells the person "tickets/<file> is claimed by <holder>, not by you".

### `close`

#### Context

**User story**: once the work is merged, an agent [1] closes the ticket; the queue entry [6] that linked it stays until `npx queue done` removes it, because the tickets never touch the agent queue.

#### Business logic

`close <file>` removes the ticket, its plan and its claim [4], each when present, and nothing else, as one commit "close tickets/<stem>", answering `{"ok":true,"file":"tickets/<file>"}`. A ticket that does not exist refuses `no-ticket`. Someone else's claim outranks the close, because closing takes the claim with the ticket: a claim naming anyone but this holder [5], or one whose line does not parse, refuses `not-holder`, the holder named when the line parses, "tickets/<file> is claimed by <holder>, not by you". A ticket with no claim, or with the caller's own, closes, the caller's own claim going with it.
