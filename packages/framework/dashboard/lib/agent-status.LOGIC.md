Picks the one word an agent's [1] status pill shows, out of its event stream [2], once the agent has ended in a way worth a word: "failed", "stopped" or "waiting for an answer", together with the colored dot and the text tone drawn beside it. A live agent, and one that ended clean, shows no pill at all. The words are exclusive, so one agent is in exactly one state everywhere it appears.

## Context

**User story**: the user scans a list of agents and each one that needs attention shows a single word for how it ended, and opens an agent's own page to find the same word in its toolbar. A red "failed" tells a crash from an amber "stopped" the user asked for, and neither from an agent that ended on a question it waits to have answered.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event stream: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[3] stop: ending an agent before it finishes: the Stop button or Ctrl-C.
[4] leg: one stretch of an agent's work between its start, or its going on after an ending, and its next ending; an agent that is answered or continued keeps writing into the same event stream.

## Business logic — TL;DR

- **No pill unless the agent's leg ended worth a word** - a live agent, or one whose current leg [4] ended clean, shows no pill.
- **One ending, one word** - stopped, waiting for an answer, or failed.
- **"failed" says what failed** - a failure shows the reason the agent's ending carried, appended to the word.

## Business logic

### No pill unless the agent's leg ended worth a word

#### Context

**User story**: a pill is a flag for the user: nothing is flagged while the agent works or once it finished clean.

#### Business logic

The ending read is the one of the agent's current leg [4]: an agent that went on after an ending (it was answered, or continued) is live again, and the ending of the leg it left behind no longer counts. While the current leg has no ending, and when it ended clean, there is no pill.

### One ending, one word

#### Context

See `## Context`.

#### Business logic

- **"stopped"** — the ending says the user stopped [3] the agent. Amber dot, amber text.
- **"waiting for an answer"** — the ending says the agent ended on its question and resumes when it is answered. Amber dot, amber text.
- **"failed"** — any other ending without success. Red dot, red text.

### "failed" says what failed

#### Context

**User story**: the user sees why an agent failed without opening it, so a whole list of agents can be triaged at a glance.

#### Business logic

When the agent's [1] ending carries a detail text, the word becomes "failed — " followed by that text. Without one it is just "failed".
