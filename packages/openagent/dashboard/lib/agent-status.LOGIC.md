Picks the one word an agent's [1] status pill shows, out of its event stream [2]: "failed", "stopped", "waiting for an answer", "building…" or "finished", together with the colored dot and the text tone drawn beside it. With no event there is no pill at all. The words are exclusive and ranked, so an agent is in exactly one state.

## Context

**User story**: on the project home (`components/AgentOverview.tsx`) the user sees a single word for where the agent whose events are shown there stands. A red "failed" tells a crash from an amber "stopped" the user asked for. An agent's own page shows no status pill: its feed and its message box say whether the agent works and how it ended.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event stream: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[3] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.

## Business logic — TL;DR

- **No pill with nothing to go on** - no event means no pill.
- **One agent, one word, ranked** - the five words sit on a fixed ladder and the first one that applies wins.
- **"failed" says what failed** - a failure carries the reason the agent's ending gave, apart from the word.
- **"building…" only while the agent is going** - the pulsing amber word is for an agent that may still stream something; the moment it ends the pill settles.

## Business logic

### No pill with nothing to go on

#### Context

See `## Context`.

#### Business logic

There is no pill while the agent [1] has no event at all. Any event is enough for a pill.

### One agent, one word, ranked

#### Context

See `## Context`.

#### Business logic

How the agent [1] ended is the ending of the event stream's [2] current leg (the rule is in `live-state.ts`). The first word that applies, top down, is the one shown.

1. **"failed"** — the agent ended without success, the user did not stop [3] it, and it does not wait for an answer. Red dot, red text.
2. **"stopped"** — the agent's ending says the user stopped it. Amber dot, amber text.
3. **"waiting for an answer"** — the agent ended on its question and waits for the user's answer. Amber dot, amber text.
4. **"building…"** — the event stream shows the agent still going (the rule is in `live-state.ts`). Pulsing amber dot, muted text.
5. **"finished"** — everything else: the agent is over with nothing more to say about it. Gray dot, muted text.

### "failed" says what failed

#### Context

**User story**: the user sees why an agent failed without opening it.

#### Business logic

The word is "failed". When the agent's [1] ending carries a detail text, that text comes with the word as its reason, kept apart from it: the project home's summary block shows "failed — " followed by the reason.

### "building…" only while the agent is going

#### Context

**User story**: a pulsing pill means something more is coming. A finished agent must not keep pulsing on a page the user leaves open.

#### Business logic

"building…" is shown only while the agent [1] is still going: its event stream's [2] current leg has not ended. As soon as its ending lands, the pill settles: on "failed", "stopped", "waiting for an answer" or, when nothing else applies, "finished". A resumed agent, or one answered after it waited, starts a new leg and shows "building…" again.
