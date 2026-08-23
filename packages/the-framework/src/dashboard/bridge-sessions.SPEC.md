Picks which cloud sessions the Claude web bridge's Chrome extension should have a tab open for, so a parked question reaches the dashboard even when nobody happens to be looking at claude.ai.

## Business logic — TL;DR

- **Only `web`-target agents that reached a cloud session** - an agent with no cloud session has no page to watch.
- **Recent only** - a cloud session is worth a tab for twelve hours after its agent started, and no longer — the same session window after which the agent's row stops saying "in cloud" (`cloud-run-state`).
- **At most three tabs, newest first** - a browser quietly filling up with tabs is worse than missing an old cloud session.
- **One tab per cloud session** - several agents pointing at the same cloud session yield a single entry.

## Business logic

### Which cloud sessions get a tab

#### User story

A `web`-target agent hands its task to a cloud session on claude.ai. If that session parks on a question, only a browser tab sitting on its page can notice — so the daemon has to tell the extension which pages to open, since the extension itself only ever sees pages the user already visited.

#### Business logic

Every agent whose run target is `web` and that recorded a cloud session id contributes that session's claude.ai page, provided the agent started within the last twelve hours. Duplicates are collapsed to one entry per cloud session. The list is ordered newest agent first and cut to three entries.

#### Rationale

Recency is the entire filter, and it has to be: a `web`-target agent is hands-off, so it is considered finished the moment it hands its task over. Every such agent therefore reads as finished whether its cloud session is parked on a question right now or wrapped up an hour ago, and there is no read-back that would tell the two apart. "Recent, and not many" is the honest rule; a liveness check would be a fiction.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
