The Overview's "Routine work" card: the routines Auto PM runs on a schedule, each with a Run now button that fires it against a project immediately, plus the switches that decide whether the schedule runs at all, which routines are in it, and how many agents it may keep going at once.

## User story

- The user wants to see, in one place, what The Framework does on its own when nobody is around — and to run any one of those routines right now instead of waiting for the schedule.
- The user wants to know what a Run now click is about to spend before clicking it: which model, where the agent runs, and how many agents it starts.
- The user wants to take one routine out of the schedule without switching the whole schedule off.
- The user wants a click that finds nothing to do to say so, rather than appearing to do nothing.

## Glossary

- **routine lock** — a routine's lock file on the data branch, naming the machine running that routine and since when, so no two machines run it at once. A routine declares whether it holds one.

## Business logic — TL;DR

- **The card is the daemon's own routine list** - the rows are the routines the daemon runs, not a second copy, so what is on screen cannot drift from what actually runs.
- **Run now takes the right path per routine** - a routine that fans out, or that has to hold its routine lock while it runs, asks the daemon to run that one routine's work; every other routine is started directly, as one unattended agent with the routine's prompt.
- **The button says what it costs first** - each Run now carries the routine's own description, the model and run target the start would use, and how many agents it starts.
- **Configure first, then run** - the secondary half of the split button hands the routine's prompt to the project's launcher instead of starting anything, so the model and run target can be changed and the prompt edited before sending.
- **The picked project is a preference** - which project the routines run in survives navigation, reloads and tabs, and is re-checked against the projects that actually exist.
- **Two tiers of switch** - the checkbox on each row is that routine's place in the schedule; the checkbox at the foot is whether the schedule runs at all.
- **Opting out is what is recorded** - every routine counts as ticked until it is unticked, so a routine introduced by a later version runs for a user who saved the setting before it existed.
- **The schedule can be fast-forwarded** - a "Trigger routine now" button runs the sweep once on demand, even while the schedule is off, and reports what it found.
- **A schedule with nothing on it is called out** - auto-run on with every routine unticked shows a warning.

## Business logic

### The card is the daemon's own routine list

#### User story

See `## User story`.

#### Business logic

Every routine the daemon runs gets a row, showing its label and its own one-line description. With no project registered, the card says "Add a project to run a routine." and shows nothing else.

### Run now takes the right path per routine

#### User story

See `## User story`.

#### Business logic

Which path a Run now takes is decided by what the routine declares about itself, never by its name, so renaming a routine cannot change how it runs.

A routine that drains the agent queue, a routine that fans out over tickets, or a routine that holds a routine lock is run by asking the daemon to perform that single routine's sweep work. A locked routine is asked for by the lock it holds rather than by its name, for the same reason the other two are asked for by what they declare. The drain covers every project the daemon watches and so carries no project; the other two are scoped to the picked project. Every other routine is started directly: one agent in the picked project, with the routine's prompt verbatim, on the user's own preferences — the repo's committed configuration is not resolved here, since the Overview has no project open — and unattended, so gates auto-answer, the agent ends when its work settles, and its handoff fires.

After a direct start, the dashboard moves to the agent that was just started. If no agent identifier came back, it moves to the project and adopts the running agent once it surfaces.

A start failure is shown on the card.

#### Rationale

The fan-out routines have to go through the daemon because only the daemon claims the work before each agent starts — a queue entry for a drain, a ticket lock for planning — and a direct start could only ever be one agent. A routine that holds a routine lock goes through the daemon for the same claim: the daemon takes that lock before the agent starts, and a direct start would run the routine unlocked.

Run now deliberately does not navigate away for the sweep-backed routines: their agents land in the Agents card, which is where a batch of them is watchable.

### The button says what it costs first

#### User story

See `## User story`.

#### Business logic

Hovering Run now states three things: the routine's own explanation of what it does; which model it will use and where it will run, taken from the same preferences the start reads — except for the drain, which says instead that each project's own settings decide those, because the drain resolves every project's own committed configuration; and how many agents the click starts. That last line has three forms: the drain sweeps every project the daemon watches, up to the configured number of agents each, unattended; a fan-out routine starts up to that number of agents in the picked project, one per open ticket, unattended; anything else starts one agent in the picked project, unattended, with nothing asked mid-run.

While a routine is starting, its own button reads "Starting…" — only that row's, not every row's.

#### Rationale

The card fires prompts on settings that live a page away in the global options, so a click's cost was invisible right up until the agent existed. The routine's description is the routine's own sentence rather than one written again here, so the launcher and this card describe a routine identically.

### Configure first, then run

#### User story

The user wants to run a routine but on a different model, or on a different run target, or with the prompt tweaked — all of which live in the launcher, not on this card.

#### Business logic

The chevron beside Run now opens a menu with one entry, "Configure first, then run": it stashes the routine's prompt as a launcher draft and opens the picked project's launcher, where the prompt can be edited and the model and run target chosen. It starts nothing, so it stays available even while a start is in flight.

For a routine whose Run now would fan out, the entry says plainly that the launcher sends one agent, not the fan-out.

### The picked project is a preference

#### User story

See `## User story`.

#### Business logic

With more than one project registered, a "Run in" picker chooses which project the routines run against; with one, there is no picker. The pick is stored as a user preference rather than held by the card, so it survives opening an agent and coming back, a reload, and other tabs. A stored pick naming a project that no longer exists falls back to the first project.

#### Rationale

Held as card state, the pick was lost on the most common navigation there is — open an agent, come back — so the next click silently landed on the first project, which is a real repo of the user's.

### Two tiers of switch, and opting out is what is recorded

#### User story

See `## User story`.

#### Business logic

Each row's checkbox controls that routine's place in the schedule; the routine's title is the checkbox's label, so the whole title is clickable. Run now sits outside that label and fires the routine once whatever the checkbox says.

The checkbox at the foot is whether the schedule runs at all — the same setting the Settings page offers. When the schedule is on and the daemon has reported when it next runs, that checkbox's label becomes a countdown ("Auto-runs …"); otherwise it reads "Auto-run".

What is stored is the set of routines opted *out*, never the set opted in.

#### Rationale

Recording opt-outs means a routine added by a later version is on by default for someone who saved the setting before that routine existed.

### The schedule can be fast-forwarded

#### User story

The schedule runs on a long interval, and the user wants the routines to go now — or wants to try them once without committing to running them unasked.

#### Business logic

"Trigger routine now" runs the sweep once immediately. It stays available while the schedule is off, in which case it says explicitly that auto-run stays off and nothing further is scheduled. While it is in flight the button reads "Triggering…".

The result is reported on the card as one line: a single project's message plainly, several projects' messages each prefixed with the project's folder name, "The sweep ran and considered no projects." when no project was considered at all, and "The sweep ran." when the report itself was unreadable. When the dashboard is served by something that does not run the sweep, it says there is nothing here to trigger. The same reporting is used for the sweep-backed Run now clicks.

#### Rationale

Clicking is asking, which is why this works with the schedule off: the auto-run preference records consent to spend quota unasked, and a click is not unasked. Reporting the outcome exists because two presses used to show literally nothing, leaving the reason recoverable only from the source — "ran and found nothing to say" must not look like "never ran".

### Concurrent agents

#### User story

See `## User story`.

#### Business logic

A number beside the schedule switch sets how many agents the routines keep going at once while there is queued work, floored at one and with no maximum. A cleared box is treated as mid-edit and saves nothing, so clearing it does not silently store the minimum. When the preference is unset, the number shown is the daemon's own default, so the figure on screen is the figure the daemon would use.

Under it, a sentence states the consequence: at one agent, work runs only while nothing else is running and the week's allowance is not already spent; above one, up to that many agents are kept going on queued work, still only while the week's allowance is not spent.

### A schedule with nothing on it is called out

#### User story

See `## User story`.

#### Business logic

When the schedule is on but every routine has been unticked, the card warns that the schedule has nothing to run — otherwise the countdown alone suggests work is coming.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
