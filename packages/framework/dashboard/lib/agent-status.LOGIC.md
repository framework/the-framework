Picks the one word an agent's [1] status pill shows, out of its event stream [2], when the caller has it, its card [3], how many of its subagents [6] are still running, and what the agent's own page knows first (a message just sent, a turn just seen ending): "failed", "stopped", "waiting for an answer", "N subagents running", "saving…", "ready for merge", "building…" or "finished", together with the colored dot and the text tone drawn beside it. With no event and no card there is no pill at all. The words are exclusive and ranked, so one agent is in exactly one state everywhere it appears.

## Context

**User story**: the user scans a list of agents and each one shows a single word for where it stands, and opens an agent's own page to find the same word in its toolbar. A red "failed" tells a crash from an amber "stopped" the user asked for, and neither is dressed up as the green "ready for merge" of a pull request the agent opened on its way.

**Problem**: an agent can hold several of these facts at the same time. It can open a pull request and then fail, or be stopped [4] on a later leg after opening one. Without a ranking, the pill would show whichever fact was checked first, and a green "ready for merge" would be a lie about an agent that then crashed.

**Problem**: on the agent's own page the word went back to "finished" for a moment at both ends of a turn. After a message to an ended agent it read "finished", "building…", "finished", "saving…", "finished": the message was sent but its line was not in the event stream yet, and the turn had ended but the card, polled every 2 seconds, had not said yet that the agent was saving.

**Business logic story**: the event stream says how the agent's current leg ended, and it arrives ahead of the card, which the dashboard polls every 2 seconds. The card says what the event stream cannot: the pull request the agent's work is on, and whether the tool that runs the agent is still saving after a clean end. So the ending is read off the event stream, and the pull request and the saving mark off the card.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event stream: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[3] card: an agent's record as the daemon hands it to the dashboard with the project's list of agents: of it the pill reads the status (`running`, `done`, `stopped`, `failed` or `waiting`), the pull request the agent's work is on, and the daemon's saving mark [5].
[4] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[5] saving: the window after an agent ended clean in which the tool that runs it still saves the agent's record on the data branch and cleans up its checkout; nothing of the agent's own work is published then. The daemon marks an agent's card saving while its status is done and its process is still alive on this machine (`src/dashboard-rpc/reads.ts`).
[6] subagent: an agent [1] started for another agent, its main agent, which split its task across subagents (the `orchestration` skill). The subagent's card names the main agent's id as its parent.

## Business logic — TL;DR

- **No pill with nothing to go on** - no event and no card means no pill; either one is enough for a pill.
- **The ending: the event stream first, the card when the stream shows none** - how the current leg ended is read off the event stream; an agent whose stream shows no ending takes it from its card's status.
- **One agent, one word, ranked** - the eight words sit on a fixed ladder and the first one that applies wins.
- **"failed" says what failed** - a failure carries the reason the agent's ending gave, apart from the word, so each place decides how much of it to show.
- **"saving…" outranks "ready for merge"** - after a clean end, while the card is marked saving, the pill says the agent's record is being saved, not that it is merely ready.
- **A main agent whose subagents still work is not "finished"** - an agent that ended clean while N of its subagents [6] are running reads "N subagents running", pulsing, below "waiting for an answer" and above "saving…".
- **What the agent's page knows first** - the page may say the agent is starting (a message was just sent): the word is "building…" at once, above every other word; and that it just watched a turn end: after a clean end the word is "saving…" as if the card were marked saving.
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

The first word that applies, top down, is the one shown. Above the ladder: when the agent's page says the agent is starting (see "What the agent's page knows first"), the word is "building…", whatever the ending.

1. **"failed"** — the agent [1] ended without success, the user did not stop [4] it, and it does not wait for an answer. Red dot, red text.
2. **"stopped"** — the agent's ending says the user stopped it. Amber dot, amber text.
3. **"waiting for an answer"** — the agent ended on its question and waits for the user's answer. Amber dot, amber text.
4. **"1 subagent running" / "<N> subagents running"** — the agent ended clean and the caller says N of its subagents [6], at least one, are still running. Pulsing dot in the primary color, muted text.
5. **"saving…"** — the agent ended clean, none of its subagents is running, and its card [3] is marked saving [5], or the agent's page says it just watched the turn end. Pulsing green dot, muted text.
6. **"ready for merge"** — the agent ended clean and its card has a pull request. Green dot, muted text.
7. **"building…"** — the event stream [2] shows the agent still going (the rule is in `live-state.ts`), or the agent has no ending and its card's status is `running`. Pulsing amber dot, muted text.
8. **"finished"** — everything else: the agent is over with nothing more to say about it. Gray dot, muted text.

How the agent ended always outranks what it did on its way: a pull request the card carries is "ready for merge" only after a clean end, so an agent stopped or failed after opening one shows "stopped" or "failed", and an agent still working with the pull request of an earlier leg shows "building…".

### "failed" says what failed

#### Context

**User story**: the user sees why an agent failed without opening it, so a whole list of agents can be triaged at a glance.

#### Business logic

The word is "failed". When the agent's [1] ending carries a detail text, that text comes with the word as its reason, kept apart from it: the agent's header shows the word and the reason on hover, and the project home's summary block, which has room, shows "failed — " followed by the reason. An ending read off the card [3] never carries a reason.

### "saving…" outranks "ready for merge"

#### Context

**Problem**: an agent that finished clean may already have opened its pull request, when it was asked to publish. During the seconds in which the tool that runs it records the agent and cleans up its checkout, showing "ready for merge" would describe what is about to be true rather than what is happening.

#### Business logic

The saving [5] window sits above "ready for merge" on the ladder, so for as long as the card [3] is marked saving after a clean end, the pill says "saving…" with a pulsing green dot, pull request or not. Once the mark is gone, the pill falls through to "ready for merge" when the card has a pull request, else "finished". An agent whose subagents [6] are still running never reads "saving…": "N subagents running" sits above it.

### A main agent whose subagents still work is not "finished"

#### Context

**Problem**: A main agent never waits in a process: it ends its turn after starting its subagents and is continued each time one of them ends. So its record says `done` while the work it was asked for is still going, and the pill said "finished", or "ready for merge", about a job half done.

#### Business logic

The caller may say how many of the agent's [1] subagents [6] are still running. The agent's page counts every subagent that holds the agent's job: one that is `running`, one that is saving, and one that ended less than 10 seconds ago, since the agent is then about to be continued (`subagents.ts`); the word says "running" for all of them. Neither the agent's event stream [2] nor its card [3] knows it, the project's list of agents does. When the agent ended clean and that number is above zero, the pill says "1 subagent running" or "<N> subagents running" with a pulsing dot, pull request or not, saving or not. It sits below "waiting for an answer" and above "saving…": a failed or stopped agent and one waiting for an answer keep their own word, and an agent that is itself working has not ended and reads "building…". It outranks "saving…" because a main agent's record is saved after each of its turns, and the pill flashed "saving…" between them while its subagents worked. Once no subagent is running, or when the caller gives no number, the pill falls through to "saving…", "ready for merge" or "finished".

### What the agent's page knows first

#### Context

See the second problem in `## Context`.

#### Business logic

The caller may hand over two facts only the agent's own page knows (`components/AgentView.tsx` decides them); a caller that hands none, such as a list of agents, gets the ladder as it is.

- **Starting**: a message was just sent to the agent, or the agent was just started, and its prompt line is not in the event stream [2] yet. The word is "building…" at once, above the whole ladder: whatever the agent's last leg ended as (clean, stopped, failed, waiting), it is about to work. With no event and no card there is still no pill.
- **Settling**: the page just watched a turn end, and the card [3] has not said yet whether the agent is saving [5]. After a clean end with no subagent [6] running, the word is "saving…", exactly as when the card is marked saving, so it does not read "finished", then "saving…", then "finished". An end that failed, was stopped, or waits for an answer says its own word at once, and "N subagents running" still outranks it.

### "building…" only while the agent is going

#### Context

**User story**: a pulsing pill means something more is coming. A finished agent must not keep pulsing on a page the user leaves open.

#### Business logic

"building…" is shown only while the agent [1] is still going: its event stream's [2] current leg has not ended, or, with no ending known, its card [3] says `running`, or the agent's page says it is starting. As soon as its ending lands, the pill settles: on "failed", "stopped", "waiting for an answer", "N subagents running", "saving…", "ready for merge" or, when nothing else applies, "finished". A resumed agent, or one answered after it waited, starts a new leg and shows "building…" again.
