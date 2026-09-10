Picks the one word an agent's [1] status pill shows, out of its event stream [2]: "failed", "stopped", "publishing…", "ready for merge", "building…" or "finished", together with the colored dot and the text tone drawn beside it. While the agent has said nothing worth a pill, there is no pill at all. The words are exclusive and ranked, so one agent is in exactly one state everywhere it appears.

## Context

**User story**: the user scans a list of agents and each one shows a single word for where it stands, and opens an agent's own page to find the same word in its toolbar. A red "failed" tells a crash from an amber "stopped" the user asked for, and neither is dressed up as the green "ready for merge" the agent claimed a minute earlier.

**Problem**: an agent can hold several of these facts at the same time. It can signal ready for merge [3] and then fail, or be stopped [4] after signalling it. Without a ranking, the pill would show whichever fact was checked first, and a green "ready for merge" would be a lie about an agent that then crashed.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[3] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[4] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[5] session name: the name an agent gives its own work; its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[6] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request), `merge` (also merge it).

## Business logic — TL;DR

- **No pill until there is something to say** - an agent that has not named its work, not signalled ready for merge and not ended badly shows no pill.
- **One agent, one word, ranked** - the six words sit on a fixed ladder and the first one that applies wins.
- **"failed" says what failed** - a failure shows the reason the agent's ending carried, appended to the word.
- **"publishing…" outranks "ready for merge"** - between a clean ending and the handoff's report, the pill says the work is being published, not that it is merely ready.
- **"building…" only while the agent is live** - the pulsing amber word is for an agent that may still stream something; the moment it ends the pill settles on "finished".

## Business logic

### No pill until there is something to say

#### Context

**User story**: an agent that has just started, before it has named its work, shows no status word rather than a word that would be guesswork.

#### Business logic

There is no pill while all of the following hold: the agent [1] has not given its work a session name [5], has not signalled ready for merge [3], has not failed, and was not stopped [4]. Any one of the four is enough for a pill to appear.

### One agent, one word, ranked

#### Context

See `## Context`.

#### Business logic

The first word that applies, top down, is the one shown:

1. **"failed"** — the agent [1] ended without success and the user did not stop [4] it. Red dot, red text.
2. **"stopped"** — the agent's ending says the user stopped it. Amber dot, amber text.
3. **"publishing…"** — the handoff [6] is still running (the rule is in `live-state.ts`). Pulsing green dot, muted text.
4. **"ready for merge"** — the agent signalled ready for merge [3]. Green dot, muted text.
5. **"building…"** — the agent is still live (the rule is in `live-state.ts`). Pulsing amber dot, muted text.
6. **"finished"** — everything else: the agent is over and said nothing more about itself. Gray dot, muted text.

How the agent ended — the first three rungs — always outranks what the agent said on its way, because an ending is the later and truer fact.

### "failed" says what failed

#### Context

**User story**: the user sees why an agent failed without opening it, so a whole list of agents can be triaged at a glance.

#### Business logic

When the agent's [1] ending carries a detail text, the word becomes "failed — " followed by that text. Without one it is just "failed".

### "publishing…" outranks "ready for merge"

#### Context

**Problem**: an agent that finished clean has usually already signalled ready for merge [3]. During the seconds in which its handoff [6] pushes the branch, opens the pull request and possibly merges it, showing "ready for merge" would describe what the agent claimed rather than what is happening.

#### Business logic

The publishing window sits above "ready for merge" on the ladder, so for as long as the handoff [6] has not reported, the pill says "publishing…" with a pulsing green dot. Once the handoff reports, the pill falls through to "ready for merge" or "finished".

### "building…" only while the agent is live

#### Context

**User story**: a pulsing pill means something more is coming. A finished agent must not keep pulsing on a page the user leaves open.

#### Business logic

"building…" is shown only while the agent [1] is still going. As soon as its ending lands, the pill settles: on "failed", "stopped", "publishing…", "ready for merge" or, when nothing else applies, "finished".
