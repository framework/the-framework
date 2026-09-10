A summary block for one agent [1], projected from its events [2], shown on the project home below the launcher while the page holds an agent's events: its status line, the errors it reported, and a link to its driver session [3]. It renders nothing at all until at least one of the three is known, so an agent that has just started shows nothing extra.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] event / event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout.
[3] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id. Say "session id" and "session link" for its id and URL.
[4] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.

## Business logic — TL;DR

- **The status line** - the agent's one ranked status (the rules in `lib/agent-status.ts`: failed with its reason, stopped, publishing, ready for merge, building, finished) as a colored dot and the word, preceded by the session name [4] once the agent has named its work; absent while the agent has said nothing worth a status.
- **The errors** - when the agent reported any errors, their count and the latest headline (`AgentErrorCount.tsx`), kept where the feed cannot scroll them away; the error rows themselves stay in the feed at the point where the agent hit them.
- **The session link** - "Open session (<session id>) ↗", opening in a new tab, only when the session link genuinely opens this driver session, that is when the link contains the session id (the rule in `lib/session-link.ts`); a generic product entry page is not offered as a link.
