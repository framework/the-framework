Decides which of the cloud sessions the daemon lists the Driver tab visits in a given cycle: the ones whose list status changed to a stopped one, the awaiting ones not looked at for a while, and any session holding a queued answer.

## User story

Fifty cloud sessions are running. The dashboard user wants every question those sessions ask carried home and every answer typed back, without the extension spending its time re-reading fifty pages twice a minute.

## Glossary

- **stopped** — a session claude.ai's session list shows as "Awaiting input" (it stopped to ask its user), "Unread response" (it finished a turn nobody has read) or idle (nothing is happening in it — the list's "Idle", or a row showing only a pull request that is not merged or closed).

## Business logic — TL;DR

- **A queued answer always earns a visit** - whatever the list says about the session; the answer is the one thing the list cannot know about.
- **A stopped session is visited when it changes** - once, when its list status differs from the last read or it has never been read.
- **Only an awaiting session is visited again on age** - when five minutes have passed since it was last visited, even with no change.
- **Everything else is left alone** - running, landed and missing sessions are never visited without an answer to deliver.

## Business logic

### Which sessions a cycle visits

#### User story

See `## User story`.

#### Business logic

For each session in the order the list gave them: it is visited when an answer is queued for it; otherwise when it is stopped and either its status changed since the last cycle that read it or it has never been visited; and otherwise when it is awaiting and its last visit is five minutes or more ago. The visits carry the session id, its status, and the answer when there is one.

#### Rationale

claude.ai's list statuses are sticky: an in-app visit clears neither "Awaiting input" nor "Unread response" (measured on the live page). Visiting every stopped session on every cycle would therefore mean fifty visits every half minute for fifty agents, so a change is what earns a visit. The age revisit is kept for awaiting sessions alone: a question asked in prose carries no question block, so the list's word is the only signal that the session is waiting and a re-read is what carries the question home. An unread or idle session has nothing new after its one visit — re-reading it every five minutes for the whole run would mirror nothing — and a session whose pull request is still open is idle rather than landed so that its later change is still seen.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
