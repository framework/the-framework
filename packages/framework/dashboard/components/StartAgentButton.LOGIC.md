Every button in the dashboard that starts an agent [1], as one two-part offer: press the button to start the agent as things are currently configured, or open the chevron beside it and take the very same prompt to the launcher [2] first, where the coding agent [3], the model, the location [4] and the prompt itself can all be changed before anything is spent.

## Context

**User story**: the user meets a start button somewhere in the dashboard — on a ticket, on a queue entry, on the routine work card — and wants that work run with a different model, or on another machine, or with a word changed in the prompt. Instead of leaving the page, changing preferences [5], coming back and hoping the button still means the same thing, the user opens the chevron and picks "Configure first, then run": the same prompt lands in the launcher [2] with every control beside it.

**Problem**: a start button spends an agent [1] on settings that live nowhere near it. Each surface solving that for itself would produce buttons that promise different things, and a copy of the promise is what lets one surface quietly stop keeping it. One control keeps the wording, the keyboard reachability and the "the chevron starts nothing" rule identical everywhere a start is offered.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] launcher: the Start form on a project home — a project's own page with the launcher and its composer (the prompt editor, also used for live chat).
[3] coding agent: the CLI doing the actual work: Claude Code or Codex.
[4] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[5] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[6] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used for live chat).
[7] fan-out: starting several agents at once, one per queue entry or one per ticket to plan.

## Business logic — TL;DR

- **Press to run it as configured** - the button half starts the agent straight away, with an icon and a label that name what it will spend.
- **"Configure first, then run"** - the chevron half hands the prompt to the launcher instead of starting anything.
- **The prompt travels with the trip** - the prompt is carried to the launcher of the project the user lands on and is filled in once.
- **The chevron is never held back by a start in flight** - only "nothing to act on at all" takes the chevron away.
- **Busy is per button, and per surface** - the button that was pressed is the only one that reads as starting, while every start button on the surface stops accepting a press.

## Business logic

### Press to run it as configured

#### Context

See `## Context`.

#### Business logic

The left half is the plain start: pressing it starts the agent [1] the surface offers, with whatever the current preferences [5] resolve to. It carries an icon and, on the roomier surfaces, a label; the dense rows are icon-only and name themselves to assistive technology instead. Hovering it shows what it does and what it is about to spend, in the surface's own words.

While this button's own start is in flight, its icon becomes a spinner and its label reads "Starting…" unless the surface gives its own busy wording.

### "Configure first, then run"

#### Context

**Problem**: which coding agent [3] runs, on which model, and where, are set in the launcher [2] and in the user's preferences [5], not on the row the button sits on. Without a way across, the only path from "this, but on the other machine" to a start is to leave the page and come back.

#### Business logic

The right half is a chevron that opens a one-entry menu. The entry is headed "Configure first, then run" and its second line says what that particular trip is for, in the offering surface's own words — for example, that the launcher [2] will start one agent [1] rather than the whole fan-out [7] the button half would.

Choosing it starts nothing. It hands the prompt over and navigates to the launcher, where the prompt can be read, edited and started with every control in reach.

It is a visible second half of the control, not something revealed by hovering: a hover target is reachable by neither keyboard nor touch, and on a dense list the row under the pointer is not always the row the user means.

### The prompt travels with the trip

#### Context

**Problem**: a trip to the launcher [2] that arrives with an empty editor is the dead end this control exists to close. The prompt has to survive the navigation, and it must not survive longer than that.

#### Business logic

The prompt is put aside for the launcher [2] at the moment the menu entry is chosen, then the navigation happens — always in that order, so the launcher never lands the user on an empty editor. It is stashed for the browser tab only and is taken by the launcher exactly once as it opens, so reloading that page does not fill the editor again. The same carrier is used for a prompt handed from one machine's dashboard to another's.

Because only the launcher of the project the user lands on picks the prompt up, the navigation goes to that project's project home [6].

For a button whose press would start several agents [1] at once, the prompt handed over is the single one a launcher can actually send, and the menu entry's second line says so.

### The chevron is never held back by a start in flight

#### Context

**Problem**: a start already running is exactly the moment a user wants to go and look at the settings. Locking the way there while one runs would be the opposite of the point.

#### Business logic

The chevron half is disabled only when there is nothing to act on at all — no project picked, for instance. It stays available while a start is in flight, because it spends nothing.

### Busy is per button, and per surface

#### Context

**User story**: a list of tickets each with its own start button: pressing one must show which one is starting, and must not let the user fire a second start into the same surface before the first has landed.

#### Business logic

Two separate states drive the button half:

- A start in flight anywhere on the surface takes the button half out, so a surface cannot fire two starts at once.
- Only the button whose own start is in flight shows the spinner and the busy label.

When the surface has nothing to act on, both halves are out.
