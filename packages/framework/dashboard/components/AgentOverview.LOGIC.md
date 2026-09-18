A summary block for one agent [1], projected from its events [2], shown on the project home below the launcher while the page holds an agent's events: its status line, the errors it hit, and a link to its driver session [3]. It renders nothing at all until at least one of the three is known, so a page holding no event of the agent shows nothing extra.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event / event stream: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[3] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id. Say "session id" and "session link" for its id and URL.

## Business logic — TL;DR

- **The status line** - the agent's one ranked status, read off its events alone (the rules in `lib/agent-status.ts`: failed with its reason, stopped, waiting for an answer, building, finished; "publishing…" and "ready for merge" need the agent's card, which this block is not handed), as a colored dot and the word; absent while there is no event.
- **The errors** - when the agent hit any errors, their count and the latest headline (`AgentErrorCount.tsx`), kept where the feed cannot scroll them away; the error rows themselves stay in the feed at the point where the agent hit them.
- **The session link** - "Open session (<session id>) ↗", opening in a new tab, only when the session link genuinely opens this driver session, that is when the link contains the session id (the rule in `lib/session-link.ts`); a generic product entry page is not offered as a link.
