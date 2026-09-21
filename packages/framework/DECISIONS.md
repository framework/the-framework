Non-obvious decisions only, grouped by business-logic flow. Anything not listed is left
to the implementer's judgment. Flag conflicts instead of silently deviating. Keep
outdated decisions (no history).

A bullet is a person's pick, and says what it was picked over. What the code does belongs
in LOGIC.md; a choice made while implementing is the implementer's judgment, not a
decision. An AI proposes a bullet and asks; it never adds or rewrites one.

## The dashboard
- A projection of files: it shows a project's runs by reading what the runs write, and it
  runs no agent of its own. Picked over the dashboard owning the agent it shows, which is
  what made every capability a person wanted — another coding agent, a schedule, a run on
  a device — a feature of The Framework.
- It ships no prompt text. What a project can be asked to do is what the project's own
  skills say. Picked over the built-in presets: a prompt that lives here cannot be read,
  changed or run by the agent working the repository.
- The tickets are a package's: The Framework reads them through the command the package
  declares (`framework.tickets`, `list --local`), and only for what it composes across
  skills, the onboarding step, a queued link's title. Showing,
  planning, claiming and releasing a ticket is the package's own widget, through its
  command. Picked over the dashboard's own ticket pages fed by the provider, which would
  have kept a reserved route and a hand-written sidebar row.
- The checkouts are a package's: The Framework finds a run's checkout, and pushes, opens,
  lands and reclaims its branch, through the command the package declares
  (`framework.branches`: `list`, `show`, `publish --branch`, `merge`, `remove`); it
  composes a pull request's title and body from the run, and keeps the rule that says
  which pull request is a run's, and its own reads of pull requests. Picked over the
  framework's own git and gh handoff, which was a second way to publish.
- Which package provides a kind of data when several installed packages declare it: the
  project's own package.json says, under the same `framework` key with the package's name
  as the value; several and no line means nothing provides it, and the project's banner
  says why. Picked over the first in dependency order, taken silently, and over routing by
  the remote's host.
- An Overview card belongs to the package whose data it shows: a widget declares its cards
  and The Framework draws them, in the order the cards name, only where a project has the
  package. Picked over the framework's own cards fed by the providers, which showed an empty
  queue to a project with no queue package. The onboarding steps stay the framework's.
- The Overview's queue card is the queue package's and its hot-tickets card the tickets
  package's, each reading through its own command; The Framework draws neither, reads no
  hot tickets and rules no lane. The lane for queued tickets was The Framework knowing both
  packages and is gone: a ticket's way onto the queue is the action the queue package
  offers on links, drawn beside the row where a project has that package.
- A run is named by its intent, else the name the branches package answers for its branch,
  else the branch as the agent named it; the framework derives no session name from a branch.
  Picked over stripping the package's prefix here, which was the framework knowing how the
  package names a branch.

## Starting a run
- A Start runs the project's own `start` line, in the project's hooks file, and the line
  answers the new run's id. The dashboard names no tool. Picked over the dashboard calling
  the tool by name: the person picks what starts their runs, and a project that starts its
  runs some other way is not a special case.
- The line gets the prompt, and the coding agent and the model when the person picked
  them; anything else is the line's own business. Picked over handing over every option
  the launcher once had, which is how the options became the thing to maintain.
- A project with no `start` line cannot start a run from the dashboard, and the launcher
  says so. Picked over a built-in fallback, which would be The Framework running agents
  again.
- No cap on a person's runs: the click is the brake. Picked over the one-run-per-checkout
  guard, which existed because runs shared a working tree and they no longer do.

## Saying something to a run
- What a person says reaches a run through what the run's tool reads: a line in the run's
  inbox file while the run works, the project's `resume` line once it has ended. Picked
  over a channel of ours that every tool would have to learn.
- A run that ends while the line is on its way has its line taken back out of the inbox
  and resumed instead. Picked over leaving it for a run that will never read it.
- An answer is checked against the question the run's diary holds open, and handed over as
  the option's label. Picked over passing the pick through: only what the agent offered
  can be answered, and the agent reads words, not ids.
- Stop is a signal to the process the run's card names, whoever runs it. Picked over a
  message to the run: a stop that has to be read is not a stop.

## A run's record
- One place: a run's card and diary in its own checkout while it works, and, once it has
  ended, what the project's runs provider answers. Picked over The Framework keeping a
  copy of its own, which is what made a run's history a question with two answers.
- A read never writes. A run whose process is gone is its tool's to sweep. Picked over the
  dashboard ending a run it did not start.
- A question stays open while the run waits on it, and closes when the agent goes on or
  the run ends for good. Picked over a run's end closing it, which left a waiting run's
  question on screen as text nobody could answer.

## Sweeping origin's scratch refs
- A branch on origin is a run's, and may be swept once landed, unclaimed by a pull request,
  old and idle, when a run's record names it, aged by that record. Picked over a naming
  pattern, `agent-<timestamp>`, which was the framework knowing how the package names a
  branch and missed a branch the agent renamed.
