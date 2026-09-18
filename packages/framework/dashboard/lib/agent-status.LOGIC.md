Picks the one word an agent's [1] status pill shows, out of its event stream [2] and, when the caller has it, its card [3]: "failed", "stopped", "waiting for an answer", "publishing…", "ready for merge", "building…" or "finished", together with the colored dot and the text tone drawn beside it. With no event and no card there is no pill at all. The words are exclusive and ranked, so one agent is in exactly one state everywhere it appears.

## Context

**User story**: the user scans a list of agents and each one shows a single word for where it stands, and opens an agent's own page to find the same word in its toolbar. A red "failed" tells a crash from an amber "stopped" the user asked for, and neither is dressed up as the green "ready for merge" of a pull request the agent opened on its way.

**Problem**: an agent can hold several of these facts at the same time. It can open a pull request and then fail, or be stopped [4] on a later leg after opening one. Without a ranking, the pill would show whichever fact was checked first, and a green "ready for merge" would be a lie about an agent that then crashed.

**Business logic story**: the event stream says how the agent's current leg ended, and it arrives ahead of the card, which the dashboard polls every 2 seconds. The card says what the event stream cannot: the pull request the agent's work is on, and whether the tool that runs the agent is still publishing after a clean end. So the ending is read off the event stream, and the pull request and the publishing mark off the card.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event stream: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[3] card: an agent's record as the daemon hands it to the dashboard with the project's list of agents: of it the pill reads the status (`running`, `done`, `stopped`, `failed` or `waiting`), the pull request the agent's work is on, and the daemon's publishing mark [5].
[4] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[5] publishing: the window after an agent ended clean in which the tool that runs it still records the agent on the data branch and pushes its branch. The daemon marks an agent's card publishing while its status is done and its process is still alive on this machine (`src/dashboard-rpc/reads.ts`).

## Business logic — TL;DR

- **No pill with nothing to go on** - no event and no card means no pill; either one is enough for a pill.
- **The ending: the event stream first, the card when the stream shows none** - how the current leg ended is read off the event stream; an agent whose stream shows no ending takes it from its card's status.
- **One agent, one word, ranked** - the seven words sit on a fixed ladder and the first one that applies wins.
- **"failed" says what failed** - a failure shows the reason the agent's ending carried, appended to the word.
- **"publishing…" outranks "ready for merge"** - after a clean end, while the card is marked publishing, the pill says the work is being published, not that it is merely ready.
- **"building…" only while the agent is going** - the pulsing amber word is for an agent that may still stream something; the moment it ends the pill settles.

## Business logic

### No pill with nothing to go on

#### Context

**User story**: an agent that has just started shows "building…" as soon as either its first event or its card has arrived, rather than no word until its first line lands.

#### Business logic

There is no pill only when the agent [1] has no event at all and the caller handed no card [3]. Any event, or a card alone, is enough for a pill.

### The ending: the event stream first, the card when the stream shows none

#### Context

See `## Context` (Business logic story).

#### Business logic

How the agent [1] ended is the ending of the event stream's [2] current leg (the rule is in `live-state.ts`): whatever the card [3] says yet, a leg the stream shows ended is ended, and a leg the stream shows going has no ending. When the event stream shows no ending — it has no event yet, or the process writing it died before its last line — the ending is read off the card's status: `running` is no ending yet, `done` a clean end, `stopped` a stop [4], `waiting` an end that waits for an answer, and `failed` a failure with no reason.

### One agent, one word, ranked

#### Context

See `## Context`.

#### Business logic

The first word that applies, top down, is the one shown:

1. **"failed"** — the agent [1] ended without success, the user did not stop [4] it, and it does not wait for an answer. Red dot, red text.
2. **"stopped"** — the agent's ending says the user stopped it. Amber dot, amber text.
3. **"waiting for an answer"** — the agent ended on its question and waits for the user's answer. Amber dot, amber text.
4. **"publishing…"** — the agent ended clean and its card [3] is marked publishing [5]. Pulsing green dot, muted text.
5. **"ready for merge"** — the agent ended clean and its card has a pull request. Green dot, muted text.
6. **"building…"** — the event stream [2] shows the agent still going (the rule is in `live-state.ts`), or the agent has no ending and its card's status is `running`. Pulsing amber dot, muted text.
7. **"finished"** — everything else: the agent is over with nothing more to say about it. Gray dot, muted text.

How the agent ended always outranks what it did on its way: a pull request the card carries is "ready for merge" only after a clean end, so an agent stopped or failed after opening one shows "stopped" or "failed", and an agent still working with the pull request of an earlier leg shows "building…".

### "failed" says what failed

#### Context

**User story**: the user sees why an agent failed without opening it, so a whole list of agents can be triaged at a glance.

#### Business logic

When the agent's [1] ending carries a detail text, the word becomes "failed — " followed by that text. Without one it is just "failed". An ending read off the card [3] never carries a detail.

### "publishing…" outranks "ready for merge"

#### Context

**Problem**: an agent that finished clean has usually already opened its pull request. During the seconds in which the tool that runs it records the agent and pushes its branch, showing "ready for merge" would describe what is about to be true rather than what is happening.

#### Business logic

The publishing [5] window sits above "ready for merge" on the ladder, so for as long as the card [3] is marked publishing after a clean end, the pill says "publishing…" with a pulsing green dot, pull request or not. Once the mark is gone, the pill falls through to "ready for merge" when the card has a pull request, else "finished".

### "building…" only while the agent is going

#### Context

**User story**: a pulsing pill means something more is coming. A finished agent must not keep pulsing on a page the user leaves open.

#### Business logic

"building…" is shown only while the agent [1] is still going: its event stream's [2] current leg has not ended, or, with no ending known, its card [3] says `running`. As soon as its ending lands, the pill settles: on "failed", "stopped", "waiting for an answer", "publishing…", "ready for merge" or, when nothing else applies, "finished". A resumed agent, or one answered after it waited, starts a new leg and shows "building…" again.
