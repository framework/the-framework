Derives what the dashboard shows about an agent [1] from its event stream [2]: the errors it hit and the driver session [5] behind it (driver, checkout [6], session id and link, model). Every derivation is a fold over the events, so the live agent view [7] and the replay of a finished agent show the identical summary.

## Context

**User story**: the agent view's error count and the latest headline beside it, and the "open session" and "Resume" affordances are all read from these projections.

**Business logic story**: nothing here is state of its own. An error is an event that happened, so the list only grows; the session behind the agent is the latest leg's.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event stream: everything an agent does, one event per line of the agent's diary — the file `<id>.jsonl` the tool that runs the agent writes under `.the-framework/` in the agent's checkout, copied onto the `agent-data` branch when the agent ends. Every surface (dashboard, terminal, replay) is a projection of it.
[5] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[6] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[7] agent view: one agent's page.
[11] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.

## Business logic — TL;DR

- **The errors the agent hit** - every error the agent reported and every error the tool that runs it wrote in its diary, oldest first, each with its headline and its detail when there is one.
- **The driver session behind the agent** - nothing before the session opening; then the driver, the checkout, the link and the model of the latest leg, plus the id and link of the latest session update.

## Business logic

### The errors the agent hit

#### Context

**User story**: the agent view shows how many errors the agent ran into, both the ones only the user can fix ("gh is not logged in") and the coding agent or its connection failing ("claude exited with code 1"), and the latest headline beside the count. Reopening a finished agent shows exactly what it showed while running.

#### Business logic

Two kinds of event in the stream each become one entry, in the order they happened:

- an error report the agent itself wrote (only agents recorded before the daemon stopped running agents carry these): its headline and, when the agent wrote one, its detail (what it ran and what that said);
- an error the tool that runs the agent wrote in the diary when the coding agent or its connection failed: the first line of its message is the headline, and the remaining lines, when there are any, are the detail. A message with nothing on its first line gets the headline "error"; an error event whose message is not text is skipped. A notice (something the driver [11] worked around) is not an error.

Nothing removes an entry: an error is something that happened.

### The driver session behind the agent

#### Context

**User story**: "open session" jumps into the coding agent's own session, and "Resume" reopens a finished agent's conversation, which needs the session id together with the directory the agent ran in.

#### Business logic

Nothing is known before the session opening event; a stream without one yields no driver session. The opening gives the driver [11], whether it is the fake demo driver, the checkout [6] the agent ran in, the session link when the opening had a literal one, and the model when one was recorded. Each session update then sets the session id and, when it carries one, the link, and keeps the rest. A continuation emits a new session opening, so the driver, the checkout and the model are the latest leg's: a leg that recorded no model clears the model rather than keeping the previous leg's. The checkout is taken from the event on purpose: a finished agent's checkout is removed, and the event is the only surviving record of where it lived.
