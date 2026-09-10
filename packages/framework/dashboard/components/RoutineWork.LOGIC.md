The Overview's "Routine work" card: the routines [1] Auto PM [2] fires on its schedule, listed straight from the daemon's own routine list so the card can never disagree with what the daemon runs. Each routine has a checkbox for its place in the schedule and a "Run now" button that starts it immediately in a remembered project; the foot of the card holds the schedule's master switch with its countdown, a button to sweep on demand, the concurrency setting, and the sweep's [3] last answer.

## Context

**User story**: from the Overview [4] the user sees which routines the daemon will run on its own, switches single routines out of the schedule, runs one right now in the project of their choice, reads what it is about to spend before pressing, and reads why the last sweep started nothing.

**Business logic story**: Auto PM has two halves, the drain [5] that spends existing work on the agent queue [6] and the rotation of routines that refills it; this card is the one surface that lists both. "Run now" on an ordinary routine takes the same path the launcher on a project home [7] takes, so the work starts now rather than the sweep being asked to come round sooner. A routine the sweep has to prepare (claim a queue entry, lock tickets, hold a routine lock [8]) is instead asked of the sweep, narrowed to that one routine.

## Glossary

[1] routine: a preset the daemon fires on its own on a schedule — update tickets, triage quick, triage consensual, plan tickets, maintenance — each switchable off and runnable on demand.
[2] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[3] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[4] the Overview: the dashboard's cross-project page at `/`.
[5] drain: starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.
[6] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[7] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used for live chat).
[8] routine lock: a file on the `agent-data` branch (`routines/<name>.lock.md`) a daemon takes before running a routine so the routine runs once across machines.
[9] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[10] fan-out: starting several agents at once, one per queue entry or one per ticket to plan.
[11] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[12] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[13] prompt agent: an agent that runs one prompt and stops there (as opposed to a build agent, which works the agent queue after its opening exchange).
[14] agent view: one agent's page.
[15] coding agent: the CLI doing the actual work: Claude Code or Codex.
[16] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[17] preset: a canned prompt the user launches from the dashboard.
[18] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[19] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).

## Business logic — TL;DR

- **The daemon's own routine list** - six routines in the sweep's order of precedence, each shown with its label and, for "Maintenance", a line saying what it does; with no project registered the card says "Add a project to run a routine." instead.
- **A remembered project to run in** - with several projects a "Run in" list picks the project, remembered as a preference across navigations, reloads and tabs; a pick naming a removed project falls back to the first project.
- **Each routine's place in the schedule** - the checkbox on a row switches that one routine out of or back into the schedule; what is recorded is the opt-out, so a routine added later is on for everyone.
- **"Run now" as a plain start** - "Update from GitHub" and "Maintenance" start one unattended prompt agent in the picked project on the user's own settings, and the dashboard goes to that agent.
- **"Run now" as a narrowed sweep** - the drain, "Plan tickets (aka spike)" and the two triage routines ask the sweep for that one routine's work, because only the sweep can claim, fan out or lock; the answer lands on the card and nobody is navigated away.
- **What a click will spend, said before it is spent** - hovering "Run now" tells what the routine does, which coding agent, model and location the start reads from the preferences, and how many unattended agents it starts where.
- **"Configure first, then run"** - the chevron beside "Run now" opens the picked project's launcher with the routine's prompt so model and location can be set first; for a fanning-out routine it warns that the launcher sends one agent, not the fan-out.
- **The schedule's master switch and its countdown** - the foot's checkbox is the same "Auto PM" preference the Settings page offers, labeled "Auto-runs in N min" while the schedule is on and the daemon has reported a next sweep, "Auto-run" otherwise; with every routine unticked it warns that the schedule has nothing to run.
- **Sweeping on demand** - "Trigger routine now" runs one sweep immediately, even while auto-run is off, and the card then says what the sweep decided per project, or that this dashboard is not running the sweep.
- **Concurrent agents** - a whole number of at least 1 (2 by default) saying how many agents the routine may keep going at once on queued work, with a line explaining what that means.
- **A failed start is said on the card** - a refused or failed plain start shows its reason under the list.

## Business logic

### The daemon's own routine list

#### Context

**Problem**: a second, hand-written list of routines in the dashboard would drift from the jobs the daemon actually runs. The card therefore renders the daemon's own list, read from the same browser-safe module the daemon uses, with no read of its own.

#### Business logic

The card is titled "Routine work". With no project registered it holds only the line "Add a project to run a routine." Otherwise it lists every routine [1] the sweep [3] can fire, in the sweep's own order of precedence (the rules in `src/auto-pm.ts`):

1. "Spin up agents working on the AI queue" — the drain [5], which works entries already on the agent queue [6]; its pull request is merged once opened.
2. "Update from GitHub" — brings the project's tickets up to date with its GitHub issues.
3. "Add quick-win work to AI Queue" — the quick triage; holds the routine lock [8] `triage-quick` while it runs.
4. "Add consensual work to AI Queue" — the consensual triage; holds the routine lock `triage-consensual`.
5. "Plan tickets (aka spike)" — plans tickets; the one rotation routine that fans out [10] to one agent [9] per ticket.
6. "Maintenance" — with the line "sweeping the codebase for maintenance work" under its label, since the label names the preset [17] rather than the work.

Each row is: its checkbox, its label (the whole label is the checkbox's hit target), and at the right the "Run now" button with its chevron.

### A remembered project to run in

#### Context

**Problem**: the Overview [4] has no project selected, yet every "Run now" needs one, and the pick decides which repository spends quota [18] and receives pushed branches. A pick kept only on the card is forgotten by the most common navigation there is, opening an agent and coming back, so the next click landed on the first registered project, the user's real one.

#### Business logic

When more than one project is registered, a "Run in" list of project names sits above the routines. The chosen project is saved as a preference [11], so it holds across navigations, reloads and tabs like the opt-outs beside it. The list of projects arrives after the card first shows and a project can be removed under a stale pick, so the saved pick is used only when it names a project still registered; otherwise the first registered project is the one run in. With exactly one project there is no list and that project is the one.

### Each routine's place in the schedule

#### Context

**Problem**: two tiers of checkbox control two different things. The one at the foot is whether the schedule runs at all; the one on each row is that routine's place in the schedule. Without row boxes, a row box would have had to lie about flipping the global switch.

#### Business logic

A row's checkbox is ticked when the routine [1] is in the schedule. Unticking it records that routine as opted out of Auto PM [2]; ticking it removes it from the opt-outs. Only opt-outs are recorded, never opt-ins, so every routine is on until it is unticked and a routine added by a later version runs for a user who saved the setting before it existed. The whole opt-out list is saved on every change. "Run now" sits outside the checkbox's label and fires the routine once whatever the box says.

### "Run now" as a plain start

#### Context

**Business logic story**: "Run now" on a routine the sweep [3] needs no preparation for takes the same path the launcher takes, with the routine's prompt verbatim, so the work starts now instead of the sweep being asked to come round sooner.

#### Business logic

For "Update from GitHub" and "Maintenance", "Run now" starts one prompt agent [13] in the picked project with the routine's prompt, on the options the user's own preferences [11] imply (the mapping in `src/agent-options.ts`), marked unattended [12]: its gates take the recommended option, it ends when its work settles, and its armed handoff [19] fires, exactly as when the sweep starts it. Only the user's own settings apply: the Overview has no project open, so the project's committed `the-framework.yml` is not layered on top, and the agent starts on the same defaults a fresh launcher would use. While the start is in flight the row's button reads "Starting…" with a spinner and every row's "Run now" is out. On success the dashboard goes to the new agent's agent view [14], not merely to its project; when the daemon reports no agent id, the dashboard lands on the project and adopts the running agent once it appears. Nothing is started while no project is picked or while another plain start is in flight.

### "Run now" as a narrowed sweep

#### Context

**Problem**: a plain start can only ever be one agent [9], and it runs unguarded. The drain [5] and "Plan tickets (aka spike)" fan out [10], and only the sweep [3] can claim the work before each agent starts: a queue entry per drain, a ticket lock per plan. The two triage routines rewrite the shared agent queue [6] and may take hours, so they hold a routine lock [8] the sweep mints before the start. Which path a routine takes is decided by what the routine declares about itself, never by its name, so a renamed routine keeps its path.

#### Business logic

For the drain, "Plan tickets (aka spike)", "Add quick-win work to AI Queue" and "Add consensual work to AI Queue", "Run now" asks the daemon to sweep now, narrowed to that one routine's work: the drain's sweep names no project because the drain visits every project the daemon watches; the other three are scoped to the picked project. Narrowing to the clicked routine means "nothing to do" is reported on the card rather than the click quietly borrowing a different routine's work. While the sweep runs, that row's button reads "Starting…". The user is not navigated anywhere: the agents land in the Overview's Agents card, where a batch is watchable. When the sweep is done the card shows its answer under the foot (see "Sweeping on demand" for the wording); when the daemon serving this dashboard runs no sweep, it shows "This dashboard is not running the sweep, so there is nothing to trigger here."

### What a click will spend, said before it is spent

#### Context

**Problem**: the card fires prompts on settings that are nowhere on it: the model and where an agent [9] runs come from the preferences [11], a page away, so a button's own cost was invisible right up until the agent existed.

#### Business logic

Hovering a routine's "Run now" shows up to three lines:

1. The preset's [17] own one-line description, the same sentence the launcher shows for that preset: "Work the entries already on the queue (TODO_AGENTS.md)", "Bring `tickets/` up to date with the GitHub issues. An empty `tickets/` gets a full first import.", "Add `tickets/*.md` to queue (TODO_AGENTS.md), only quick-win and consensual tickets", "Add `tickets/*.md` to queue (TODO_AGENTS.md), only significant (no quick-wins) and consensual tickets", "Turn `tickets/*.md` into costed plans (`tickets/*.plan.md`)", "Queue maintainability + security work per codebase subset (TODO_AGENTS.md)".
2. The settings the start reads, rendered from the very preferences the start uses: which coding agent [15], which model and which location [16], as one line such as "Claude Code · Opus · This machine"; a model that is not pinned, or is pinned for the other coding agent, reads "the CLI's own default" (the rule in `lib/agent-settings.ts`). For the drain [5] this line is instead "Each project's own settings decide the model and where it runs.", because the sweep resolves each project's own `the-framework.yml` and visits every project rather than the picked one.
3. What the click spends: for the drain, "Sweeps every project the daemon watches, up to N agents each, unattended." ("agent" when N is 1); for a routine that fans out [10], "Starts up to N agents in <project>, one per open ticket, unattended."; for every other routine, "Starts one agent in <project>, unattended — nothing is asked mid-run." N is the "Concurrent agents" setting and <project> the picked project's name.

### "Configure first, then run"

#### Context

**User story**: the user wants to run a routine [1] but on another model or another location [16] than the preferences [11] say, or wants to edit its prompt first, without leaving the page to change settings and coming back.

#### Business logic

Beside every "Run now" is a chevron whose menu offers one entry, "Configure first, then run", carrying the routine's prompt to the picked project's launcher on its project home [7] so the prompt can be edited and the coding agent [15], model and location set before it is sent (the button's own rules are in `StartAgentButton.tsx`). The entry's second line says what the trip is for: "Opens the launcher with this prompt, so you can set the model and where it runs." for an ordinary routine, and for the drain [5] or "Plan tickets (aka spike)" "Opens the launcher with this prompt — one agent, not the fan-out.", because the launcher can only ever send one agent [9]. The chevron is out only when no project is picked; a start in flight does not disable it, since it starts nothing. Its accessible name is "Other ways to run <routine label>".

### The schedule's master switch and its countdown

#### Context

**Business logic story**: the foot's checkbox is the same "Auto PM" preference [11] the Settings page offers, shown where the schedule it governs is listed. Its countdown is the sweep's [3]: the sweep reports only once the daemon has run one, so before that first report, or with the schedule off, the box says what it does rather than when.

#### Business logic

The foot of the card holds a checkbox that turns Auto PM [2] on or off. Its label is "Auto-runs <when>" while Auto PM is on and the daemon has reported when its next sweep is due, where <when> is "any moment" once the moment has passed, "in N min" under an hour, and "in N hr" beyond; otherwise the label is "Auto-run". Hovering it says "Automatically run the ticked routines on a regular schedule." The daemon's report is re-read every 30 seconds while the card is open. When Auto PM is on and every routine is unticked, a warning under the foot says "Every routine is unticked, so the schedule has nothing to run.", because from the countdown alone it would look as if work were coming.

### Sweeping on demand

#### Context

**Problem**: the sweep [3] runs on a long interval, so without a trigger the only way to fast-forward it was to tick Auto PM [2] off and on again. The Auto PM preference [11] records consent to spend quota [18] unasked; clicking a button is asking, so the trigger works while auto-run is off, and the daemon then sweeps once with the schedule staying off. A fire-and-forget click could show nothing at all, so the click waits for the sweep and shows what it decided.

#### Business logic

The "Trigger routine now" button beside the switch asks the daemon to sweep immediately; it reads "Triggering…" and is out until the daemon answers. Hovering it says "Run the scheduled sweep now instead of waiting for the countdown." while Auto PM is on, and "Run the sweep once now. Auto-run stays off, so nothing further is scheduled." while it is off. Every reason to stand down other than the schedule being off still holds daemon-side (the rules in `src/auto-pm.ts`). The daemon's answer is shown as one status line under the foot, replacing the previous one:

- when this dashboard is served by a daemon that runs no sweep: "This dashboard is not running the sweep, so there is nothing to trigger here.";
- when the sweep ran but its report could not be read: "The sweep ran.";
- when it considered no project (none registered): "The sweep ran and considered no projects.", so "ran and found nothing to say" never looks like "never ran";
- when it considered one project: that project's own sentence, what was started or why it stood down;
- when it considered several: each project's sentence prefixed with the project folder's name, joined by " · ".

The same line reports a narrowed sweep fired by a row's "Run now".

### Concurrent agents

#### Context

**Business logic story**: only the drain [5] fans out [10], because it takes work off the agent queue [6] one entry at a time, so several agents [9] at once do disjoint work; a routine that invents work rewrites the queue and stays one agent per sweep whatever this says (the rules in `src/auto-pm.ts`).

#### Business logic

Under the switch, "Concurrent agents" is a number field; hovering its label says "How many agents the routine keeps going at once while there is queued work." The value shown is the number the sweep [3] would use: the saved preference [11], or 2 when none is saved. A typed value is rounded to a whole number and floored at 1, with no upper bound; an emptied box is treated as mid-edit and saves nothing, and a value that is not a number saves nothing. The line under it explains the setting in force: "Only while nothing else is running and the week's allowance is not already spent." when the number is 1, and "Keeps up to N agents going at once on queued work, and only while the week's allowance is not already spent." otherwise.

### A failed start is said on the card

#### Context

**Problem**: the daemon refuses a second agent [9] on a checkout that already has one, and a start can fail outright; a click that silently did nothing would leave the user pressing again.

#### Business logic

When a plain start is refused because an agent is already active for the project, the card shows "An agent is already active for this project." under the routine list; any other failure shows the daemon's own message, or "Failed to start the agent." when it carries none (the shared rules in `lib/use-start-agent.ts`). The message stays until the next start attempt clears it.
