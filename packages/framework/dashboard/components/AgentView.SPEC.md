One agent's page on the dashboard: its action bar, its event log, and the box the user types into — the same frame whether the agent is still running or already finished.

## User story

- The user opens an agent to watch it work, answer it, and see what it changed.
- The user comes back to a finished agent to read what happened, review the branch it left, and push or open a PR from it.
- The user is reading an agent at the exact moment it finishes, and does not want the page to blank out and rebuild itself under them.

## Business logic — TL;DR

- **One frame for running and finished** - the bar, the feed and the composer stay in place for an agent's whole life; only what they say changes when it ends.
- **The event log's source swaps without blanking** - a running agent's log arrives live; a finished agent's is read back from its archive and slid in behind what is already on screen.
- **The live stream wins while it knows more** - a resumed agent renders immediately instead of waiting for the daemon's poll to admit it is running again, and the archive takes back over once it has caught up.
- **A foreign log never overwrites the agent's own** - the archive's opening event is the fingerprint the live stream has to match before it is allowed to win.
- **"Still working" is not "still alive"** - an agent parked on the user stays alive to take the next message, so what the page offers keys off whether the agent has settled, not whether its process is up.
- **What the branch holds, on demand** - the bar summarises the changes and the handoff, and opening it reveals the agent's own details plus the file-level detail.
- **Where the agent runs is announced, not hidden** - GitHub Actions, cloud session and device targets each get their own notice instead of an apparently stalled empty feed.

## Business logic

### One frame for running and finished

#### User story

The user is reading an agent at the moment it finishes.

#### Business logic

The action bar, the event log and the composer are the same three surfaces for the whole life of an agent. When the agent stops, none of them is replaced — each one re-reads its own state and updates in place. The agent's own name leads the action bar as its stable identity, with its project shown as a `project / agent` breadcrumb, so the branch renaming itself near the end of an agent reads as one detail changing rather than the whole page changing.

#### Rationale

This used to be two separate pages that the dashboard swapped the instant an agent's status flipped: the action bar blanked while it re-read git, the output was replaced by a loading message while the archive was fetched, and the composer was rebuilt. An agent ending is the moment the user is most likely to be reading it, and the whole page flinched.

### The event log's source swaps without blanking

#### User story

The user watches an agent's output live, and keeps reading it after the agent ends.

#### Business logic

While the agent runs, its live event stream is the truth and nothing is read from the archive. Once it ends, its archived event log is read back, and the events already on screen keep their place until the archived copy is in hand. An empty archive never replaces what is on screen: the archive read answers "empty" both for an agent that is gone and for one not archived yet, and stopping an agent races the archive being written.

While the archive is being read for an agent that has no events on screen at all, the page says it is loading the agent — as opposed to a running agent with nothing yet, which is simply waiting for its first event.

### The live stream wins while it knows more

#### User story

The user resumes a finished agent and expects to see it working again straight away.

#### Business logic

The daemon's agent poll can take a couple of seconds to notice that an agent is running again. In that window the live stream is already carrying the new leg, so whenever the live stream holds more events than the archive, the live stream is what is shown, and the archive is re-read behind it. Once the re-read archive has caught up it takes back over, which is also how events that only ever land in the archive — a clean agent's handoff record, written after its worktree is torn down — reach the screen without the user refreshing.

The feed's own verdict, not the poll's, decides whether the agent counts as running for the purpose of scrolling and of what the composer offers. So a resumed agent starts following new output, and Stop takes over from Resume, the moment the first new event lands.

#### Rationale

Serving the frozen archive during that window made a whole continuation appear in one jolting jump — or, when the poll lost the race entirely, not appear at all until a manual refresh.

### A foreign log never overwrites the agent's own

#### User story

The user opens a finished agent whose worktree has already been cleaned up.

#### Business logic

"The live stream knows more" is only trustworthy when that stream is this agent's own event log. For an ended agent whose worktree is gone, the live read falls back to the project root's event log, which holds whatever was written there last — possibly a longer, unrelated feed. The archive is the agent's own record, so its first event is the fingerprint the live stream must match before it is allowed to win. An archive that is empty or not loaded yet cannot be checked, and the live stream is shown as before.

### "Still working" is not "still alive"

#### User story

An agent parks on a question or finishes its task, but stays available for the user's next message.

#### Business logic

An agent that has settled keeps its process up so it can take the next message, so its reported status stays "running" indefinitely. What the page offers therefore keys off whether the agent has settled rather than off its process:

- While the agent is genuinely still working, the bar offers the arming controls that decide how far the finished work will publish itself.
- Once it has settled, the bar offers the handoff actions themselves — the ones that actually push, open the PR, or merge.

The same distinction decides when what the branch holds is read: not when the process stops, but when the agent stops working, because an agent still writing to its branch has nothing to hand off yet while a parked agent's branch is finished work.

#### Rationale

Keying this off the process meant a finished agent showed its arming checkboxes forever and never offered the action they describe — the agent was done, and the answer to "what do I do now?" was nothing.

### What the branch holds, on demand

#### User story

The user wants to know what an agent touched, and what became of it.

#### Business logic

The action bar carries a one-line summary and expands into detail.

- While the agent works, the summary is a live count of the files it has changed and lines added and removed, and expanding shows the file-level changes.
- Once it has settled and the handoff has been read, the summary switches to what the branch actually holds — pushed, PR opened, merged — and expanding shows that in full.

The summary swaps exactly once, from live counts to the handoff, rather than blanking for the beat the handoff read takes. A handoff that was armed and then failed says so on the bar, because the actions merely reappearing looks like nothing was tried. Errors reading the handoff are shown there too.

Expanding the bar also always reveals the agent's own facts — which agent this is and what it spent — above the change or handoff detail.

### Where the agent runs is announced, not hidden

#### User story

The user starts an agent somewhere other than this machine and wonders why the feed looks empty or stalled.

#### Business logic

Each run target that behaves differently from a local agent gets its own notice above the feed:

- A GitHub Actions agent replays its whole log in a burst at the end, so the feed looks stalled while it runs. The notice says the wait is expected and links to the live Actions run.
- A `web` agent's work happens in a Claude Code cloud session this machine cannot stream, so the notice points at where the work is instead of showing an empty feed, and a question that session parks on is answered right there on the notice, as this agent's own gate. That agent's log dead-ends at the hand-off, so the box showing what the cloud session did next rides the tail of the scroller, where "and then…" belongs.
- An agent relayed to a device runs elsewhere but has its changes, handoff and push/PR relayed back, so those panels are shown as for a local agent and the notice only flags that the browser preview stays local.

Losing the live channel is surfaced as a banner over the feed rather than as silence.

### Reading and leaving

#### User story

The user removes a finished agent's leftovers, or deletes the agent entirely.

#### Business logic

Whether a finished agent still has its worktree decides whether the bar offers to remove it: a failed or stopped agent keeps its worktree, a clean one had it removed when it finished. Once removed, the offer disappears immediately rather than waiting for the next read. Deleting the agent leaves this page and returns to the project's home.

A finished agent's log is static, so it does not follow new output — it opens at the end, where the outcome, the final spend and the last changes are. How the agent ended is also handed to the composer, which is where the offer to resume it lives.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
