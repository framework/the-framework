Decides which of the cloud sessions the daemon lists the Driver tab visits in a given cycle: the parked ones whose state changed or has not been looked at for a while, and any session holding a queued answer.

## User story

Fifty cloud sessions are running. The dashboard user wants every question those sessions ask carried home and every answer typed back, without the extension spending its time re-reading fifty pages twice a minute.

## Glossary

- **parked** — a session claude.ai's session list shows as "Awaiting input" (it stopped to ask its user) or "Unread response" (it finished a turn nobody has read).

## Business logic — TL;DR

- **A queued answer always earns a visit** - whatever the list says about the session; the answer is the one thing the list cannot know about.
- **A parked session is visited on change, and again after a while** - when its list status differs from the last read, or five minutes have passed since it was last visited.
- **Everything else is left alone** - idle, running, landed and missing sessions are never visited without an answer to deliver.

## Business logic

### Which sessions a cycle visits

#### User story

See `## User story`.

#### Business logic

For each session in the order the list gave them: it is visited when an answer is queued for it; otherwise only when it is parked and either its status changed since the last cycle that read it, it has never been visited, or its last visit is five minutes or more ago. The visits carry the session id, its status, and the answer when there is one.

#### Rationale

claude.ai's list statuses are sticky: an in-app visit clears neither "Awaiting input" nor "Unread response" (measured on the live page). Visiting every parked session on every cycle would therefore mean fifty visits every half minute for fifty agents. Change and age together keep the cost at a handful of visits per cycle without ever letting a parked session go unlooked-at for long, and the answer rule keeps the user's pick from waiting on either.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
