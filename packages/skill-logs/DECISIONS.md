Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating. Keep
outdated decisions (no history).

A bullet is a person's pick, and says what it was picked over. What the code does belongs
in SPEC.md; a choice made while implementing is the implementer's judgment, not a
decision. An AI proposes a bullet and asks; it never adds or rewrites one.

## The logs
- Two callers: the command an agent runs, which only reads, and a long-lived program that
  keeps the branch checked out, records every run it drives through this package's
  functions when the run is over, and shows the runs in pages of its own. The executable
  is `logs`. The package ships `SKILL.md`, the agent's instructions.
- A run is two files on `agent-data`, the branch `@gemstack/agent-data` names, never on a
  code branch: `agents/<who>/<id>.json`, the card, and `agents/<who>/<id>.jsonl`, the
  diary. Both are pushed. Keeping the diary on the machine that ran it was considered and
  dropped: a run's page on another machine, a continued run on another machine and a
  wiped laptop all read the diary from the branch, and a few megabytes a year is the
  price.
- `<who>` is the git email the writer's repository commits as, lowercased, unsafe
  characters replaced, `anonymous` when unusable. The folder groups the runs by person and
  protects nothing: ids never collide, and the same email authors the commits. A flat
  `agents/<id>.json` with the person inside the card was the alternative and was not
  taken: the grouping stays visible in a file listing.
- The card is small and the package's: `id`, `startedAt`, `endedAt`, `status`, `intent`,
  `driver`, `model`, `branch`, `pr`, `ticket`, `cost`. Everything else a writer records
  sits under one key of its own, `caller`, which the package stores and never reads.
  Owning the writer's whole record, renamed field by field, was rejected: a program's
  private fields would become a standalone package's public API. Under semver these
  fields are the branch's public API: a change to them is a major.
- The diary is JSON lines. The package knows four kinds — `said`, `result`, `ended`,
  `cost` — and skips every other line a writer adds. A writer maps its own events onto
  the four; the package never learns them. A line may carry more fields than its kind
  needs; they pass through.
- Agents only read. A note an agent leaves on its own run was considered and deferred: the
  record lands on the branch only when the run is over, so a note would need a file of its
  own or a record written at the start.
- The skill says when to look back: before planning or working a ticket, read its runs.
  Leaving that to the caller's prompts was the alternative and was not taken: outside the
  caller nobody would ever read the logs.

## Flow: the command
- `logs` lists newest first and prints the package's fields only, never `caller`: the
  writer's bookkeeping is not the agent's business.
- `logs` prints the newest 20 runs unless `--limit` says otherwise: a list of every run,
  each with its prompt, is more than an agent should read for a look back.
- `--ticket <file>` matches a card whose ticket is that path or ends with `/<file>`, so a
  ticket's filename and the path a queue entry links to both find it. The package does
  not know where tickets live.
- `show` prints the card with the four kinds of diary line, never the whole diary: an
  agent cannot read a hundred kilobytes of a writer's bookkeeping, and the writer's own
  pages replay the whole file themselves.
- A read fetches origin once and reads everything from that copy: only origin has every
  writer's pushes. With no origin the local branch is read. Outside a repository a
  command refuses `not-a-repo`; only git's own "not a git repository" reads as that. An
  id no run has refuses `no-run`.
- Every command that runs prints one JSON document. A refusal also puts one line on
  stderr and exits 1. A malformed command line (an unknown flag, the wrong argument
  count, a `--limit` that is not a whole number above 0, an id that is not one) is
  rejected first: the usage on stderr, nothing on stdout, exit 2. Anything a command
  throws refuses with `git-failed`.

## Flow: what the writer records
- A run is recorded once, when it is over, as one commit carrying both files. Two late
  facts, the branch the work landed on and the pull request, are patched onto the card
  afterwards, one commit each. A run is deleted as one commit, both files. A run a dead
  writer left marked running is recorded again by the next writer that notices, ended,
  where it already sits. Nothing else on a card changes after it lands.
- The writer's persistent checkout is `.branches/agent-data`, and its writes go through
  that checkout's serialized cycle, the same as the other skills'. The command never
  touches it.
