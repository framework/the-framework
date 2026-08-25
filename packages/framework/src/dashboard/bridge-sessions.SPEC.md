Picks which cloud sessions the Claude web bridge's Driver tab serves, so a parked question reaches the dashboard even when nobody happens to be looking at claude.ai.

## Business logic — TL;DR

- **Only `web`-target agents that reached a cloud session** - an agent with no cloud session has no page to visit.
- **Recent only** - a cloud session is served for twelve hours after its agent started, and no longer — the same session window after which the agent's row stops saying "in cloud" (`cloud-run-state`).
- **All of them, newest first** - one Driver tab serves the whole list by reading claude.ai's own session list and visiting only the sessions that need it, so the list is not capped.
- **One entry per cloud session** - several agents pointing at the same cloud session yield a single entry.
- **Whether an answer is queued** - each entry says whether the dashboard holds an answer for it, since such a session is visited whatever the list says.

## Business logic

### Which cloud sessions are served

#### User story

A `web`-target agent hands its task to a cloud session on claude.ai. If that session parks on a question, only a browser page can notice — so the daemon has to tell the extension which sessions are its, since the extension itself only ever sees pages the user already visited.

#### Business logic

Every agent whose run target is `web` and that recorded a cloud session id contributes that session's claude.ai page, provided the agent started within the last twelve hours. Duplicates are collapsed to one entry per cloud session. The list is ordered newest agent first and carries, per entry, whether an answer is queued for the session.

#### Rationale

Recency is the filter on this side, and it has to be: a `web`-target agent is hands-off, so it is considered finished the moment it hands its task over. Every such agent therefore reads as finished whether its cloud session is parked on a question right now or wrapped up an hour ago. The read-back that tells those apart is the status the Driver reads off claude.ai's session list, which the bridge store keeps — not anything on the agent's record.

The cap of three entries this list used to have existed because each entry cost a browser tab. The Driver tab reads the list's statuses and visits only the sessions that need it, so a long list costs a sidebar read rather than a tab each.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
