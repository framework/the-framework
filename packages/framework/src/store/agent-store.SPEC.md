The durable record of every agent: its event log, the agent meta derived from that log, and the archive a finished agent leaves behind. Everything the product shows about an agent — the live view, the history list, the "needs you" list, the CI watch — is a read of this record, so the rules for writing it and for deciding which copy of it wins are settled here once.

## User story

- The user watches an agent work and wants the dashboard to reflect it truthfully: what it was asked to do, which branch and pull request it produced, whether it is working or waiting on an answer.
- The user reloads the dashboard, or restarts the daemon, and expects to find every agent exactly where it was — including the ones that died in a crash.
- The user comes back later and wants a project's history of what agents have done to the repo, their own and their teammates'.

## Glossary

- **agent meta** - the agent's current status record, the file `agent.json` beside its event log. A summary of everything the event log says about the agent, so a reader can render a row without replaying the log.

## Business logic — TL;DR

- **The event log is the record; the agent meta is its summary** - every fact about an agent is an event, and the agent meta is those events folded together.
- **An agent id is its start time** - ids sort chronologically as plain text, so "newest first" needs no timestamps parsed.
- **Continuing an agent reopens its record** - a follow-up writes into the same agent rather than creating a second one, and keeps the original label.
- **A finished agent is archived under its user on the data branch** - the lasting record is per user and off the code history; a second, throwaway copy covers agents with no worktree.
- **A crash never loses history** - an agent that never closed cleanly is archived by whoever notices next.
- **A dead agent is forced to an end** - an agent whose owning process is gone is credited with the ending it never wrote, so nothing shows as live or awaiting an answer forever.
- **The agent meta survives being read mid-write** - a reader never sees a half-written record and so never reports a live agent as gone.
- **A project's agents are the live ones plus the archived ones** - composed once, with the live copy always winning.
- **Facts learned after the agent is gone are patched onto its archive** - the branch and pull request that only became knowable later.

## Business logic

### The event log is the record; the agent meta is its summary

#### User story

The user opens an agent and sees a header: what it was asked for, which coding agent CLI is doing it, the session link, the branch, the pull request, whether it is ready for merge, whether it is parked on a question. A list of many agents shows the same facts without opening any of them.

#### Business logic

An agent's every fact arrives as an event appended to its event log, and the agent meta is the running fold of those events: each appended event refines the record, and the record is stored beside the log rather than rebuilt from it.

The agent meta carries: whether the agent is running, done, stopped or failed; its id and its start and last-update times; the process and host that own it; what it was asked for; which driver and workspace it uses; the wrapped CLI's session id and session link; the branch its work is on, and the session name that branch carries (its `tf-` prefix removed — none while it is the birth spelling), folded with it; the ticket it implements, when the framework picked one; the pull request opened for it; whether it signalled ready for merge; what its handoff is armed to do and how that handoff reported back; the gate it is parked on; whether it has settled on the user; for a cloud session, whether the browser bridge reports it waiting on a human, and whether another machine's daemon started the agent — both marked by the daemon on the way to the dashboard, never stored; the port its browser preview listens on; its run target and, for a relayed agent, the device label; whether it started as a build or a direct prompt; the model the current leg runs; and, for a cloud session, the hand-off anchor commit.

Individual folding rules that are not merely "the last value wins":

- A gate opens when a choice event arrives and closes only when the resolution names that same gate, so a stale resolution cannot clear a newer question.
- Any new turn from the driver clears "settled": the agent has gone back to working.
- The model is recorded per leg. A leg that reports no model leaves the model unknown rather than inheriting the previous leg's, because the agent may have resolved a different default.
- A skipped handoff's reason is cleared whenever a later handoff does not skip, so a resumed agent that published on its second leg is never read as having had nothing to publish.
- An ending sets the outcome and clears everything that only makes sense while the agent is alive: the pending gate, the settled mark, and the browser preview port.

Being settled — parked on the user — is deliberately kept apart from the agent's outcome, because a settled agent is still alive: its process runs, it still accepts messages, and it still holds its checkout.

Persisting is best-effort. Appends are written in order, and a write that fails is reported but never allowed to break the running agent.

#### Rationale

The dashboard is a projection of the event stream, so persisting the agent *is* durably logging that stream — there is no second state model to keep in step. The agent's own chat transcript is deliberately not persisted; the wrapped CLI owns that.

Several facts sit on the agent meta rather than being left to the event log alone, because their reader is in a different process from their writer and has no event history to fold: the handoff arming shown as checkboxes, the browser preview port the daemon must proxy, the handoff's merge outcome the CI watch scans for, and the skip reason a sweep uses to decide whether to release a ticket claim.

The branch is recorded as the agent observes it, and corrected at teardown while the worktree still exists, rather than being derived. It cannot be derived: a finished agent loses its checkout, and the agent renames its branch itself, so the agent-id branch is not guaranteed to hold the commits. The session name, by contrast, is derived — from the branch, every time the branch is recorded — and never announced on its own.

### An agent id is its start time

#### User story

The user's history list is ordered newest first, across hundreds of agents, without waiting.

#### Business logic

An agent id is its ISO start time with the separators replaced so it is safe as a filename. Because the format is fixed width, ids compare as text in the same order they happened, and every "newest first" ordering is a plain text sort with no timestamps parsed. The reverse conversion is available for a caller holding an id but no record.

An id is required to be path-safe — letters, digits, dashes and underscores only — everywhere it is used to build a path, so no id can escape its directory. An id that is not path-safe is refused rather than followed.

The daemon allocates the id before it spawns the agent, because the worktree directory is named with it; the agent adopts that id rather than deriving a second, slightly later one.

A history read that only wants recent agents states a cutoff, and archived records older than that are rejected by their filename alone — most of a long history is skipped without being read at all. Only a name that parses as one of these ids can be rejected this way; any other name is read normally.

### Continuing an agent reopens its record

#### User story

The user replies to a finished agent to take the work further, and expects one row in the history that grew, not a second agent that starts empty.

#### Business logic

A continuation reopens the record already at the agent's location: the event log is kept, the agent is flipped back to running, and the continuing process takes ownership so a liveness probe reads it as alive rather than orphaned. If there is nothing to reopen, a fresh agent starts instead.

A reopened agent keeps its original label. The continuation's own request would otherwise overwrite the row's label with the follow-up message, so the original is pinned for the rest of the agent's life.

The flow an agent started under is recorded so a continuation can re-enter it: without that record, continuing a build agent would drop it into the plain prompt path, losing the framing and the backlog loop that belong to a build.

Continuing also needs the agent's history back in the checkout it reads from. Teardown moved that history into the repo, so restoring puts the archived event log and agent meta back into the worktree — unless the worktree already holds a live agent, whose own log is newer and must not be overwritten.

### A finished agent is archived under its user on the data branch

#### User story

The user, and their teammates, can read months later what agents did to the repo — including agents whose throwaway checkouts are long gone.

#### Business logic

When an agent closes, its event log and agent meta are copied out as a pair named after its id. The lasting home is the user's own directory on the data branch's checkout: on the data branch so the record survives cleaning the repo and never touches the code history, and per user so two people's machines write side by side instead of colliding. A second, throwaway home inside the agent's own framework directory covers an agent with no worktree of its own, and the crash rescue.

Archiving is what makes teardown safe. An agent writes its record inside its own worktree, so deleting the worktree would delete the record with it; the copy into the repo happens first. The copy inside the worktree is deliberately left untracked, or it would be committed onto the agent's own branch and collide with the lasting copy at merge time.

At the moment of teardown, the branch actually holding the agent's commits is read from the checkout and stamped onto the archived record — the last moment it can be observed at all.

Reading a project's history means reading every user's archive directory plus the throwaway one, because the history is a team-visible record of what has been done to the repo. The same agent can appear in more than one place — rescued into the throwaway copy and archived into the committed one — so records are de-duplicated by id, with the committed copy winning. Unreadable or half-written records are skipped rather than failing the whole read. Archiving the same agent twice is harmless.

An archived agent's event log can be replayed in full, applying the same tolerance for a torn last line as the live log.

### A crash never loses history

#### User story

The user's machine or daemon dies mid-agent. Nothing about that agent disappears.

#### Business logic

Starting a fresh agent in a location first rescues whatever agent is still sitting in the live files there, archiving it unless it is already archived. So an agent that crashed before it could close still leaves its history behind, retroactively, the next time that location is used.

Reading an event log tolerates a torn ending: a blank or unparseable final line — the signature of a write cut short — stops the read, and everything before the cut is kept. The same rule applies wherever an event log is read, live or archived, so no reader can drift to a different policy.

### A dead agent is forced to an end

#### User story

An agent's process dies without saying so — a crash, a hard kill, the machine sleeping. The user must not be left with a row that claims to be running, whose Stop button does nothing, and whose question appears answerable when nobody is listening for the answer.

#### Business logic

A running agent records the process and host that own it. A record claiming to be running whose owning process is provably gone on this host is an orphan; one whose owner is alive is left alone; and one that cannot be probed at all — no owner recorded, or an owner on another machine — is a distinct third state.

The two places that check treat that third state differently on purpose. The check that runs when the daemon boots treats an unprobeable agent as finished, since a fresh daemon drives no agent in flight and there is nothing better to go on. The check that runs on every ordinary read leaves it alone, because a routine read must never declare an agent dead that another machine may still be running.

Healing an orphan does not merely change its outcome: an ending is appended to its event log on its behalf, recording that the process died without reporting one, and that ending is then folded in like any other. Every surface keys "this agent is over" off that one ending, so a death that skipped it would leave the agent's last question rendering as answerable forever. Folding it also closes the gate the agent died holding. The healed agent is then archived, so its history is kept.

The boot-time reconciliation covers all three places an orphan can hide: archived records still marked running, the live record at the project root, and an agent inside a worktree. A worktree agent is healed in place and copied into the repo's history, but its worktree is left on disk — an agent that ended this way did not end cleanly, and those are kept for inspection; removing one is an explicit action. The count of agents reconciled is reported back. Every step is best-effort: a failure skips that agent rather than failing the sweep.

#### Rationale

Liveness used to be decided by assuming a fresh dashboard drives no agent in flight, which holds only while exactly one dashboard is ever started. A second one marked genuinely live agents as finished, giving them a Stop button that did nothing.

A process id is probed by signalling it with no signal: gone means the agent is dead, and refused-permission means it exists under another user and is therefore alive. A process id reused by an unrelated process reads as alive — an accepted, vanishingly rare miss on a single machine.

### The agent meta survives being read mid-write

#### User story

The dashboard polls constantly while the agent rewrites its own record constantly. The user must never see the agent blink out of existence.

#### Business logic

The agent meta is written to a scratch file and swapped into place in one step, so a reader gets either the whole previous record or the whole new one, never half of either. The scratch file is named after the writing process, because an agent and the daemon tearing it down can both be writing the same record and must not splice their writes together.

As a backstop, a record that will not parse is re-read a couple of times after a brief pause before it is declared corrupt: a torn read is transient by construction. A record still unreadable after that yields nothing.

#### Rationale

Writing the record in place truncates the file before refilling it. A reader landing in that window saw an empty file and reported the agent gone, which made a live agent vanish from every composed read for a whole poll. The atomic swap prevents that; the retry can only paper over it, which is why both exist and the swap is the real fix.

### A project's agents are the live ones plus the archived ones

#### User story

The user looks at a project and sees one list: what is running now and what has run before, newest first, each appearing exactly once.

#### Business logic

A project's live agents are found by looking in every place one can run: each checkout under the worktrees directory, and the repo root itself — which is where an agent runs when the project cannot be given a worktree. Each candidate is read with the same self-healing read, so a stale agent is cleaned up wherever it lives, and an unreadable checkout is skipped rather than failing the list. Each live agent is reported together with the checkout it is running in, because an agent's git and file status must be read from its own checkout, not the project path.

Only directories named as agent branches count as checkouts; the renamed-branch links that sit beside them are views, not checkouts, and are ignored.

The full list is the live agents followed by the archived ones that are not already live, newest first. The live copy always wins: continuing an agent gives it both an archived record from its first leg and a live one now, and preferring the archive would show a running agent as finished. Looking up a single agent by id follows the identical rule.

#### Rationale

This composition — not either half on its own — is what callers actually want, which is why it is defined once here; three separate parts of the product had each grown their own copy of it.

### Facts learned after the agent is gone are patched onto its archive

#### User story

An agent finishes, and only afterwards does the pull request get opened, or does a cloud session's branch become identifiable. The user's history row must show the real branch and pull request, not "nothing committed".

#### Business logic

An archived agent's record can be amended with the branch its work landed on and the pull request its work is on. There is no event stream left to carry these facts, and every surface reads the record, so this single amendment is what turns an empty-looking row into its real outcome. Because the archive lives on the data branch's checkout, an amendment is only durable once committed, so callers outside tests go through the data branch's writer rather than writing directly.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
