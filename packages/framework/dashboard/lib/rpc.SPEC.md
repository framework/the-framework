How the dashboard talks to the daemon: every call is a `POST /_rpc/<name>` carrying its arguments as JSON, and the live feed is a `GET /_rpc/events` stream of one agent's events. Both go to the same origin the dashboard was served from, so the browser attaches the daemon's cookie on its own and the user has nothing to configure.

## Business logic — TL;DR

- **Calls report the daemon's own reason for failing** - a rejected call carries the message the daemon gave; a reply that is not JSON at all is reported as such, naming the call and the HTTP status.
- **The live feed tells a clean end apart from a dropped one** - the daemon finishing a stream is not the same as the stream dying, and only the second one means the daemon is unreachable.
- **A damaged event does not kill the feed** - an event that cannot be read is dropped and the stream keeps running.

## Business logic

### The live feed tells a clean end apart from a dropped one

#### User story

The user watches a running agent in the dashboard. If the daemon goes away — closed, crashed, machine asleep — the dashboard must say so, instead of showing an agent that merely looks quiet. But an agent's feed also ends for ordinary reasons: the project is unknown to the daemon, or a relayed stream from another device is finished.

#### Business logic

A feed that the daemon ends on its own closes cleanly, and the dashboard treats it as "there is nothing more to send". A feed that dies mid-stream closes with a failure, which is the dashboard's cue to retry with backoff and to tell the user the daemon is not answering. The dashboard closing the feed itself — leaving the page, switching agents — counts as a clean end, never as an outage. Failing to subscribe in the first place is also reported as a failure, so the caller retries.

#### Rationale

The feed is read as a plain stream rather than through the browser's built-in server-sent-events client, because that client reconnects on its own schedule: it would fight the dashboard's retry timing and report every end as an error, erasing exactly the clean-versus-dropped distinction the dashboard depends on.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
