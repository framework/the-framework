The button every surface starts an agent with: press it to run the work as configured, or take its second half — "Configure first, then run" — to open the project's launcher with the same prompt and set the model, the run target and the prompt itself before sending.

## User story

- The user wants to start the work a button offers, in one click, without leaving the page it is offered on.
- The user wants to run that same work on a different model, in a different place, or with the wording changed — none of which the button's own page can show.
- The user wants both to be reachable by keyboard and on a touch screen, not only under a mouse pointer.
- The user wants to know what a press is about to spend before pressing it.

## Glossary

- **launcher** — a project's home page, where a prompt is typed and the model and run target are chosen before an agent is started.
- **start button** — a button that starts an agent. Every one of them in the dashboard is this component.

## Business logic — TL;DR

- **Two halves, one control** - the press that runs it now, and beside it a chevron whose menu holds "Configure first, then run".
- **Configure first starts nothing** - it hands the prompt to the launcher and goes there; no agent, no sweep.
- **A start in flight closes the press, never the chevron** - going to look at the settings is not a start.
- **Each button says what its press costs** - the hover carries what the caller wants said about the click.
- **The caller says what the launcher trip is for** - the menu entry's second line is the caller's own sentence, because the trip is not the same act on every surface.

## Business logic

### Two halves, one control

#### User story

See `## User story`.

#### Business logic

The button is one control with two halves: the primary half runs the work, and the chevron beside it opens a menu holding a single entry, "Configure first, then run". The two are drawn joined, so they read as one control rather than two buttons.

Each half carries an accessible name of its own. On the dense rows — the queue card, the ticket list — the primary half is an icon with no text, and it is then named by the caller; a labelled button is named by its own label. The chevron never has text, so it is always named by the caller, after the thing the button acts on.

#### Rationale

A split button rather than a control revealed on hover: what only exists under a mouse pointer is reachable by neither keyboard nor touch, and the row the pointer happens to be on is not always the row the user means.

### Configure first starts nothing

#### User story

The user wants to run this work but on another model, in another place, or with the prompt changed — all of which live in the launcher, not on the button's page.

#### Business logic

Taking "Configure first, then run" carries the button's prompt to the launcher and opens it. Nothing is started: no agent, no routine sweep. The prompt is carried the same way a prompt is carried across a device hop — the launcher picks it up once as it opens, so a reload does not seed it a second time.

Which launcher it opens is the caller's to say, and it is always a project's own: a carried prompt is picked up by the launcher of the project the user lands on. Carrying the prompt is the button's own doing rather than each caller's, so no surface can navigate away and leave the user at an empty composer — which is the dead end this half exists to close.

For a press that would start several agents at once, the prompt carried is the one agent a launcher can actually send; the caller's description then says so, rather than letting the two halves look like the same act.

### A start in flight closes the press, never the chevron

#### User story

See `## User story`.

#### Business logic

Three states close or mark the button, and they are not the same thing:

- A start already in flight on that surface closes the primary half — one start at a time — and leaves the chevron open, because it starts nothing.
- Having nothing to act on at all, such as no project picked, closes both halves: there is no launcher to open either.
- The button's *own* start being the one in flight is what puts that button on its busy wording and turns its icon into a spinner, so a surface with several start buttons marks only the one that was pressed.

### Each button says what its press costs

#### User story

See `## User story`.

#### Business logic

The primary half carries a hover written by the caller: what the work is, and what the press is about to spend — how many agents, in which project, on which model and where it runs. The button holds no opinion about the wording, since only the caller knows what its own press does.

### The caller says what the launcher trip is for

#### User story

See `## User story`.

#### Business logic

The menu entry always reads "Configure first, then run", so the offer is the same sentence everywhere it is met. Its second line is the caller's: for an ordinary start, that the launcher is where the model and the run target are set; for a press that fans out, that the launcher sends one agent rather than the fan-out.

#### Rationale

One component rather than the pattern copied onto each surface: the wording, the keyboard reachability, and the rule that the chevron survives an in-flight start are the same promise on all of them, and a copy is what lets one of them quietly stop keeping it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
