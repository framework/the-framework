Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating. Keep
outdated decisions (no history).

A bullet is a person's pick, and says what it was picked over. What the code does belongs
in SPEC.md; a choice made while implementing is the implementer's judgment, not a
decision. An AI proposes a bullet and asks; it never adds or rewrites one.

## The forge as a skill
- GitHub is a skill: this package teaches an agent how to work with GitHub and declares the
  one command the framework and the scheduler run for the forge
  (`"framework": { "forge": "github" }`). `gh` runs in this package only; no other skill
  names GitHub or `gh`. Another forge is another package answering the same command;
  the framework and the scheduler name none. Picked over a forge adapter inside the
  branches package, which would have kept a request half in a skill about git.
- Pushing is not this package's: the branches package pushes, and the agent, the framework
  and the scheduler compose push then open through the two declared commands. Picked over
  one `publish` that pushed and opened, which was one skill naming another.

## Flow: open
- The agent opens its own pull request when it finishes: `npx github open` with the title
  and body the agent wrote, and the merge armed on green when whoever started it says the
  work may land on its own. Picked over whoever started the agent opening it, which needed
  a run process that knew the agent's words: the agent knows them.
- `open` opens no second request for a branch that has one open, and never opens a draft
  when the merge is armed.
- The branch must be on the remote already; `open` neither pushes nor checks, GitHub's own
  refusal is the answer.

## Flow: merge
- `merge <number>` lands a request for a person or the scheduler: a draft is marked ready,
  then the merge is armed exactly as `--merge` arms it; a request no longer open is refused.
  Picked over the dashboard merging with `gh` itself.
- Where the repository allows no auto-merge, this package's own watcher waits for the checks
  and merges, as its own detached process; a red request is left open for a person. Picked
  over merging at once, which would land work whose checks had not run.

## Flow: requests
- One read answers every question about pull requests (a branch's, the open ones, the ones
  merged since a time), in one shape; a read `gh` cannot answer is a refusal, never an
  empty list, so "none" and "could not tell" never look alike to a caller.

## The command
- Every command prints one JSON document on stdout: the result or the refusal. A refusal
  adds one line for a person on stderr and exits 1. A malformed command line: the usage on
  stderr, exit 2. The same contract as the other skills' commands.
