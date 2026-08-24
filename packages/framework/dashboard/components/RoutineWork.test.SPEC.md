What the tests cover: the "Routine work" card's rows, its Run now paths, and the settings at its foot.

**The rows.** Every routine the daemon runs gets a row, named by its own label, with a second line only for the routines that describe themselves. With no project registered the card says to add one and offers no Run now.

**Run now, plain start.** For a routine that is a single start, the click sends the routine's prompt verbatim, in the picked project, unattended, and then moves to the agent it started. A start that reports no agent identifier still hands over the project, so the dashboard can adopt the running agent when it surfaces. A failed start neither navigates nor leaves the button stuck on "Starting…", and shows the failure. A start already in flight disables every Run now.

**Run now, sweep-backed.** The drain's click asks the daemon for a drain-only sweep across every project, sending no project and starting nothing directly, and does not navigate. The planning routine's click asks for planning in the picked project only. A routine that must not run twice at once is asked for by the lock it declares, never by its name, and scoped to the picked project, with nothing started directly. A dashboard that does not run the sweep says there is nothing to trigger rather than failing silently.

**What Run now promises.** The hover states the routine's own sentence, the model and run target the start would use — read from the preferences, saying "the CLI's own default" when no model is pinned and ignoring a model pinned for the other driver — and how many agents the click starts: one agent for a plain start, up to the configured number one per open ticket for the fan-out routine, and for the drain, every project the daemon watches, up to that number each. A concurrency of one is worded as one agent. The drain's hover says each project's own settings decide its model and location instead of promising these ones.

**Configure first, then run.** The chevron's menu entry opens the picked project's launcher with the routine's prompt carried over, starting neither an agent nor a sweep, and stays available while a start is in flight. Its wording says "one agent, not the fan-out" for the routines whose Run now fans out, and otherwise promises that the model and run target can be set.

**The picked project.** Several projects get a "Run in" picker; one project gets none. The pick is stored as a user preference, read back on the next render and honoured by Run now and by Configure first; a stored pick naming a project that no longer exists falls back to the first.

**The schedule switch.** It is the one global preference, shown with a countdown to the next sweep when the schedule is on and the daemon has reported one, and as plain "Auto-run" otherwise. Every routine starts ticked; unticking one records only that routine, and re-ticking it leaves the other opt-outs intact. Run now ignores the tick state entirely. Auto-run on with every routine unticked warns that the schedule has nothing to run, and the warning goes as soon as one routine is back on.

**Trigger routine now.** It fires the sweep instead of waiting out the countdown, and stays available with the schedule off, where its hover says auto-run stays off. Its answer is reported: a single project's message plainly, several projects' messages each prefixed by folder name, and "not running the sweep" for a dashboard without one. The sweep-backed Run now clicks report their outcome the same way.

**Concurrent agents.** The box shows the daemon's default until it is set and offers no maximum; typing writes the value floored at one — any higher count is written as typed — and emptying the box writes nothing. The sentence under it follows the number rather than promising an idle machine.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
