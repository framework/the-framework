The Onboarding card: the five things a fresh install needs set up, each shown in the state it is actually in, each with the action that gets it done. It is what turns a just-installed daemon into one that can work unattended.

## User story

A user installs The Framework and opens the dashboard for the first time. They should not have to read documentation to learn what The Framework needs from them, and they should be able to do each thing from this one card.

## Business logic — TL;DR

- **Five steps** - add a project; fill the agent queue; fill `tickets/`; enable browser notifications; add a Discord webhook. The first two are what the agent cannot work without; the other three are marked Optional.
- **Done is observed, never claimed** - each step's tick comes from a real fact (a registered project, a non-empty agent queue, a ticket on disk, a granted browser permission, a Discord webhook the daemon holds). A step cannot be ticked by clicking it, and a step done outside the dashboard shows up ticked anyway.
- **Each unfinished step carries its own action** - and the action disappears once the step is done, so a finished card is a list of struck-through lines and nothing to press.
- **Dismissible in one place only** - the Overview offers to hide the card; the settings page always shows it, which is what dismissing promises the user they can come back to.
- **Live** - the underlying facts are re-read on their own, so a step completed elsewhere ticks itself without a reload.

## Business logic

### The five steps and how each is judged done

#### User story

See `## User story`.

#### Business logic

**Add a project** — done once at least one project is registered. A project is described as a git repository The Framework may work in. While it is not done, the card offers to register the directory the daemon is running in (naming that directory on the button) when that directory is not already a project, and always offers the add-project dialog — the system folder picker — as the alternative. A failure to register is reported in place.

**Populate the queue of AI tasks** — done once at least one unchecked entry exists in a project's `TODO_AGENTS.md`. The card explains that each unchecked entry is work the agent picks up on its own, so a filled queue is what lets it keep going unattended. This step has no button: the queue is filled by the agent and by the user's own planning.

**Populate `tickets/`** — optional; done once any project has tickets. The card explains that `tickets/` holds the bigger things to work on, that the agent researches and plans them, and that they are the input the queue is filled from. Its button, "Update from GitHub", starts an agent on the target project with the `update_tickets` preset — whose empty-`tickets/` behaviour is the first import — and the dashboard then lands on that agent so the user watches the import happen rather than arriving at an empty launcher. Beside it, "Configure first, then run" opens the target project's launcher carrying that same preset instead of starting anything, for the user who wants the import on a different model or somewhere other than this machine. With no project registered yet, both halves are disabled and the step says to add a project first — there is no project to start in, and none to open a launcher for.

**Add browser notifications** — optional; done once the browser has granted permission *and* the user's browser-notification preference is on. Pressing Enable turns the preference on and, if the browser has not yet been asked, asks it — the request has to ride the user's own click. A browser that has blocked notifications, or that does not support them, says so instead of offering the button.

**Add Discord notifications** — optional; done once the daemon holds a Discord webhook. Its button opens the dialog that saves one, and saving there ticks this step, the settings page's row, and the notifications bell together.

#### Rationale

Every step is marked optional or not individually rather than by its position in the list, so the list can be reordered without the "nothing breaks if you skip this" promise moving to a different step.

### The target project onboarding acts on

#### User story

The card's actions have to run somewhere, but the card is shown on the Overview and the settings page, neither of which has a project selected.

#### Business logic

Actions act on the project the daemon is running in when that directory is registered, and otherwise on the user's only (or most recent) project. Onboarding is a first-agent flow, so there is rarely a second candidate.

### Dismissing it

#### User story

The user has set up what they care about and does not want the card on their Overview forever.

#### Business logic

On the Overview the card carries a remove control whose label states the promise: the onboarding can be resumed on the settings page. Dismissing is stored in the user's preferences. The settings page's copy of the card has no remove control.

### Progress read-out

#### Business logic

The card's header counts how many of the five steps are set up. A done step is struck through and shows a ticked checkbox; an unfinished one shows an empty one. They are checkboxes rather than circles because these are independent things to tick, and an outlined circle would read as one option out of a set to choose between.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
