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
  skills, the hot-tickets card, the onboarding step, a queued link's title. Showing,
  planning, claiming and releasing a ticket is the package's own widget, through its
  command. Picked over the dashboard's own ticket pages fed by the provider, which would
  have kept a reserved route and a hand-written sidebar row.

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
