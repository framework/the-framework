Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating.

## The tickets
- Two callers: the command an agent runs, and a long-lived program that keeps the branch
  checked out and starts agents through the package's library; it imports issues with its
  own code. The executable is `tickets`. The package ships `SKILL.md`, the agent's
  instructions: where the files live and never to write through the root link; install,
  then `npx tickets`; the commands and what they answer; claim before planning or working,
  release before stopping unless closed, close once the work is merged; the ticket, plan
  and queue formats, the code parsing part of them, with the filename convention
  `<DATE>_<SLUG>.md`, the plan's optional sections, its `Outdated:` key and its rubric for
  rating uncertainty.
- A ticket is a markdown file in `tickets/`. Its plan and its claim (who is working on it)
  sit beside it: `<name>.plan.md` and `<name>.lock.md`, `<name>` the filename without
  `.md`.
- Tickets live on `agent-data`, the branch `@gemstack/agent-data` names, never on a code
  branch. The program's sync runs three steps in order. It seeds an empty `TODO_AGENTS.md`
  when the branch has none, so the queue is a file before its first entry. It links
  `tickets` at the project root to the relative target `.branches/agent-data/tickets`,
  only when nothing of that name sits at the root. Then it converges the checkout with
  origin. A seed that cannot commit stops before the link; a link that cannot be made is
  ignored, and the sync still reports the pull. The link is hidden by two rules in
  `.git/info/exclude`, `/tickets` then `!/tickets/`, written on the run that creates the
  link even when the symlink fails. `/tickets` hides the link, `!/tickets/` re-admits
  directories, which a symlink is not, so the checkout keeps committing its own `tickets/`
  under the same repo-wide exclude.
- Closing a ticket deletes it, its plan and its claim, and nothing else; a queue entry
  linking it stays until `queue done`.
- `list` answers newest first by the `<DATE>_` in the filename, `yyyy-mm-dd` at its start,
  ties by filename ascending. A filename with no date takes the file's modification time,
  or the epoch when read from git, which sorts last.
- A ticket's row, the same fields from `list` and `show`: the title from its `# ` line,
  the summary from the first prose line after `## TLDR`, else after the title, scanning
  past headings to the end of the file (a `Source:` line is skipped in both scans, matched
  case-sensitively unlike every key: a trailer on imported tickets, not a field), `Topics:
  [a, b]` split into tags, `GitHub:` into label and url, `Priority:` verbatim. Plus
  whether a plan sits beside it, whether a lock does (`locked`, present only when true),
  whom the lock names, and the plan's `Effort:` and `Uncertainty:`, absent unless a whole
  number 0-10. Keys and headings match in any case, `## TLDR` as the whole line; a
  ticket's keys are read only above the `# ` title, a plan's above its title or, when it
  has none, anywhere. `list` reads the first 4000 characters of a ticket, `show` all of
  it, so the two can differ on a long ticket. The row's keys: `file`, `title`, `summary`,
  `priority`, `topics`, `github` (`label`, `url`), `date`, `planned`, `locked`,
  `lockedBy`, `effort`, `uncertainty`; `show` nests the row as `ticket` with its text as
  `content`.
- A ticket may carry a `GitHub:` line, but importing issues is the program's job.

## Flow: a claim
- A claim is a committed file holding one line, `CLAIMED: <who>`, so agents on other
  machines see it.
- One claim per ticket; it never expires: it lifts when the ticket is released or closed,
  otherwise only by hand on the branch. The command lifts only its own lock, and closes
  only when the ticket has no lock or its own, `not-holder` otherwise. The program that
  started an agent releases what the agent left claimed, naming the holder it expects or
  none; none frees whoever holds the lock.
- Releasing an unclaimed ticket is a refusal.
- A lock is written only by a claim; someone else's `claim` is refused while it exists.
  `put` ignores it, so an import can refresh a ticket someone holds.
- A claim the program's write cycle committed but could not push still counts: the commit
  already guards this machine's readers, and the gap goes to the program's log. A cycle
  that could not commit claims nothing. The program's release is judged the same way:
  committed counts, unpushed or not. A queue edit is not: it counts only once pushed.
- Claiming a ticket you already hold succeeds and writes nothing: a re-run after a lost
  race must not read its own lock as someone else's.
- The holder is never typed: `AGENT_ID` when non-blank, else the current branch. The id
  outlives the branch: a rename mid-session would leave a lock naming a branch nobody
  answers to. A checkout on no branch is refused, never claimed as `HEAD`. The checkout's
  folder name is not read: the layout is the caller's.
- The program says whether a claim is for planning or implementing: a claim for planning
  is skipped, no lock written, when the ticket already has a plan, unless the lock is
  already this holder's: the lock is checked before the plan; a claim for implementing
  ignores the plan; only someone else's lock stands in its way. The command always claims
  to implement. The program's claim writes the lock without reading the ticket, so a
  ticket closed under it gets an orphan lock.
- The lock's existence is the claim: the holder it names decides who may close or release,
  not whether the ticket counts as locked. A lock whose line does not parse still holds
  the ticket, and no command lifts it: only the program's release naming no holder, or a
  hand edit on the branch. A lock file that cannot be read at all is treated as absent,
  and the next claim overwrites it.

## The queue
- The queue is one markdown file on the branch, `TODO_AGENTS.md`: sections `## Priority
  10` down to `## Priority 0`, any `## Priority N` counts, N one or two digits ending at a
  word boundary; any `-`, `*` or `N.` list item in the file is an entry, wherever it sits.
  Entries are placed to keep the file sorted high to low; nothing re-sorts on read.
- An entry is plain text, trimmed: the task a future agent is started with. `--ticket`
  writes the entry as a markdown link to the ticket, the given text as its label,
  unescaped. The ticket is read off the fetched branch before the write, for its priority
  and to refuse an entry pointing at no ticket; the program reads the link back to claim
  the ticket for the agent it starts.
- `queue add` creates the queue file when the branch has none, holding the one entry. An
  entry with no priority goes at the end of the file, in whatever section ends it; one
  linked to a ticket takes the ticket's priority unless `--priority` was given; a ticket
  whose `Priority:` is missing or unreadable counts as 5, never clamped: 10 and 0 are
  reserved ends (act immediately, only if capacity). A priority the file has no section
  for gets one, before the first lower section, or after the last priority section when
  none is lower; a file with no priority section gets it above its first `## ` section, so
  an unranked section cannot bury a deliberate one; a file with no `## ` section gets it
  appended. An entry joins its section right after its last item, before the blank lines;
  only a `## ` heading ends a section.
- Done means deleted, never checked off: a `- [x]` line is not an open entry; a `- [ ]`
  line is, printed and removed without its box.

## Flow: the command
- The command reads with `list`, `show` and `queue`, and writes with `put` (a ticket, a
  plan, or `meta.json`, all inside `tickets/`; the bytes as given, unparsed), `close`,
  `claim`, `release`, `queue add` and `queue done`.
- `show`, `claim` and `close` refuse a missing ticket with `no-ticket`. Every write
  refuses `no-remote` without an origin, and `claim` and `close` check the ticket inside
  the write, so `no-remote` comes before `no-ticket`; `release` writes too but looks only
  at the lock, so an orphan lock naming you lifts. `claim`, `close` and `release` read the
  holder after the filename check, so a checkout on no branch answers `no-identity` next;
  `put` checks only the name, so a plan can be written for a ticket that does not exist,
  and writes whatever stdin gives, an empty file included.
- A ticket is named to any command by its bare filename or by its `tickets/<file>` path,
  so a queue entry's link target can be pasted in as is; a sibling's name (`.plan.md`,
  `.lock.md`) is `invalid-path` to every command, `put` taking `.plan.md` the one
  exception.
- No command reads `meta.json`: the importing program is its only reader, for the one key
  it keeps there, `lastImportedAt`; an unparsable file reads as no stamp.
- A read fetches origin once and reads everything from that copy (the library's queue read
  fetches only when asked): only origin has every writer's pushes, this command's own
  included. With no origin the local branch is read: writes are refused there, so nobody
  else can have moved it.
- Every command that runs prints one JSON document, the result or the refusal; a refusal
  adds one line on stderr and exits 1. A malformed command line (an unknown flag, the
  wrong argument count, an empty `queue add` text, a `--priority` off the 0-10 scale) is
  rejected first: the usage on stderr, nothing on stdout, exit 2. A file no command may
  touch is an ordinary refusal, `invalid-path`.
- Anything a command throws refuses with `git-failed`.
- `list` and a bare `queue` answer with a JSON array; every other result and every refusal
  is an object with `ok`.
- Outside a repository a command refuses `not-a-repo`; only git's own "not a git
  repository" reads as that.
- A write's result echoes the file as `tickets/<name>`, a row's `file` is bare; `claim`
  and `release` also answer the holder, `queue add` and `queue done` the entry, `queue
  add` its priority when placed, `show` the plan and the holder when there are any; a
  refusal names the bare file or the entry it was given, `invalid-path` the argument as
  typed (`put`'s with the `tickets/` prefix stripped), `git-failed` its detail, and
  `no-remote`, `no-identity` and `not-a-repo` name nothing. The refusals: `no-ticket`,
  `claimed` and `not-holder` (both with the holder, when readable), `no-lock`, `no-entry`,
  `no-identity`, `no-remote`, `invalid-path`, `not-a-repo`, `git-failed`.
- A write is one commit per command (`put tickets/<file>`, `close tickets/<stem>`, `claim
  tickets/<stem>`, `release tickets/<stem>`, `queue add: <entry>`, `queue done: <entry>`;
  the program's seed is `seed the queue`; its batch claim is one commit, `claim <n>
  tickets` for the n it locked, or the single form when n is one), pushed straight to
  origin through a throwaway worktree at origin's tip; a push that loses a race is
  re-applied on the new tip by `@gemstack/agent-data`.
- `queue done` takes the entry as `queue` printed it, trimmed, removes the first such
  line, and refuses a line the queue does not have, an empty one included, decided inside
  the write.
