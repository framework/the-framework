What the tests cover: how an agent's record is written, summarized, archived and read back.

**Starting and appending**

- A fresh start clears any previous event log and writes an initial agent meta marked running, seeded with what the agent was asked for so its row is never blank.
- A non-local run target is recorded; a local one is left off as the default.
- Appending writes one event per line and keeps the agent meta in step with it.
- The last-update time advances with each event rather than staying pinned at the agent's start time.
- The agent adopts the id the daemon allocated, and falls back to the derived one if that id is not path-safe.
- An agent id converts to and from its start time, and a foreign id converts to nothing.

**Folding events into the agent meta**

- A later request refines the seeded one.
- The model is recorded per leg: the latest leg wins, and a leg that reports no model leaves it unknown rather than inheriting.
- Handoff arming is mirrored, including whether merge is armed, without padding fields the arming never stated.
- The handoff's report (done, skipped, failed) is recorded; a skip reason is recorded only for a skip and is cleared by any later handoff that published; the merge outcome is recorded when the handoff had a merge half.
- An agent that threw is failed; one the user stopped is stopped, not failed.
- Being parked on the user is tracked separately from the outcome: a parked agent is still running, the next driver turn un-parks it, and ending clears it.
- The branch is recorded as observed — the birth branch, then the agent's own rename — with no session name stored beside it, and the ready-for-merge signal is recorded without clobbering it.
- The ticket an agent implements outlives the agent, so a finished agent still shows which ticket it was.
- A gate opens on a choice and closes only on the matching resolution; ending clears it.
- The pull request opened for the agent, and the branch its work is on, are recorded; a mid-flight rename replaces the branch; both survive the ending.

**Reading the log**

- The persisted log round-trips.
- A torn final line from an interrupted write is dropped and everything before it is kept, on the live log and on an archived one.
- A workspace that never ran yields no events.
- Opening without a fresh start preserves the existing log.

**Archiving and history**

- Closing copies the agent's log and agent meta into the archive, and the history lists them newest first with what each was asked for and how each ended.
- Starting a fresh agent first rescues a prior agent that crashed without closing, so its history survives.
- A worktree agent's record is read out for the daemon to record on the data branch before its checkout can be removed — its missing ending written, the branch stamped, nothing landing in the throwaway archive — and the boot rescue copies such a record into the throwaway archive, an agent still marked running recorded as stopped.
- The history lists the branch's runs, every person's, plus the throwaway archive, under their one current name only; an agent filed in two places is listed once; an archived log replays wherever it is filed.
- A history read given a cutoff keeps a run on the branch by the start time on its card, whatever its id, and skips an older record in the throwaway archive by its filename without opening it.
- A run on the branch replays as the framework's events — the skill's four kinds of line mapped back, every other line as it is — is listed with its card's caller fields unfolded into the meta, and restores into a worktree as that event log and that meta.
- A run on the branch stuck at running is ended through the skill's write funnel: the card ends and dates it, keeps the framework's fields under caller, and the diary gains the ending.

**Liveness and self-healing**

- A fresh start records the process and host that own the agent.
- Reading a live agent whose owning process is gone flips it to stopped and archives it; one whose process is alive is left alone; one with no owner recorded, or an owner on another machine, is left alone for the boot reconciliation to handle.
- The boot reconciliation flips throwaway-archived agents stuck at running, flips and archives the live one counting it once, and rescues an agent a crashed daemon left inside a worktree. It leaves alone any agent whose process is provably alive on this host, and does nothing on a clean or empty workspace.
- Healing a dead agent writes the ending it never wrote: the ending lands in the live log, in the worktree's own log and in the archived copy, and the gate the agent died holding is cleared everywhere. An agent that wrote its own ending gets no second one.

**Surviving concurrent reads and writes**

- The agent meta is never opened for writing at its own path — it is written beside itself and swapped in one step, leaving no scratch file behind — so a concurrent reader never sees an empty file.
- A record that will not parse is re-read rather than reported as an absent agent; one that is corrupt for good yields nothing.
- A filesystem that cannot swap files still writes the record in place.
- Only the current name of the status record counts; a file under an older name is not an agent.

**Finding a project's live agents**

- Live agents are found in each worktree, newest first, each carrying the checkout it runs in, plus one at the project root for a project that cannot be given a worktree.
- A directory that is not named as an agent's branch, including a renamed-branch link, is never mistaken for a checkout.
- A dead agent inside a worktree self-heals on this read exactly as a single read heals one.
- A project that never ran yields nothing.

**Continuing an agent**

- Continuing reopens the same agent: same id, log preserved and appended to, running again, owned by the continuing process, and keeping what it was originally asked for even though the resume message arrives as a new request.
- The flow the first leg started under is preserved across the continuation.
- Continuing with nothing to reopen starts a fresh agent.
- An archived agent's history is restored into its worktree so the continuation reads its own past; a checkout that already holds a live agent is left untouched, and a missing archive is a no-op.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
