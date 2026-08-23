Serves the dashboard's whole request surface on the daemon: `POST /_rpc/<name>` for every action the dashboard takes, and `GET /_rpc/events` for the live event stream — behind two guards that stop a web page the user merely visited from starting or steering agents on their machine.

## User story

The user's browser is the only interface to The Framework, and it runs on the same machine as the daemon. Everything the dashboard does — start an agent, answer a gate, push, change a preference — travels over this surface, and a page from any other website must never be able to do the same.

## Business logic — TL;DR

- **One surface, one host** - every action is a call under `/_rpc/`, and the live event stream is one long-lived request beside them; the daemon wires everything they act through.
- **Cross-origin calls are refused** - a call whose browser-declared origin is not this dashboard is rejected outright.
- **Rebound names are refused** - when the daemon is bound to loopback, a request arriving under any other host name is rejected.
- **A clean end is not a lost connection** - the event stream ends the response cleanly when there is nothing more to send, which the dashboard reads as "done" rather than "reconnect".
- **A failed call is answered, not fatal** - an action that throws answers with its error message and the daemon stays up.
- **Bounded input** - request bodies are size-capped, and a malformed one is refused.

## Business logic

### Cross-origin calls are refused

#### User story

The user has the dashboard open on their own machine. While browsing, they visit some other site; that site must not be able to reach into the dashboard and spawn or steer an agent.

#### Business logic

Every browser attaches the originating site to a cross-site request. A call whose stated origin is neither this dashboard's own address nor a loopback address is rejected as forbidden, as is one whose stated origin is malformed. A request that states no origin at all is accepted: it comes from a non-browser caller, which has no ambient session for a hostile page to abuse.

### Rebound names are refused

#### User story

A hostile page whose domain name resolves to the user's own machine would look, to the browser, like the dashboard talking to itself — and would therefore pass the cross-origin check.

#### Business logic

When the daemon is bound to a loopback address, the name the browser was asked for is checked as well: only a loopback name, or the exact address the daemon is bound to, is accepted; anything else is a rebound name and is rejected, as is a request that carries no host name at all.

A daemon deliberately bound to a non-loopback address is reached by a name that cannot be predicted, so there is no list to check it against; that case is protected by the shared daemon token instead.

### The live event stream

#### User story

The dashboard shows an agent's events as they happen, and must be able to tell "this agent's stream is finished" apart from "the daemon went away", because only the second calls for reconnecting.

#### Business logic

A single long-lived request streams one event per line for the requested project and, optionally, one specific agent. When the source is exhausted, or when the request names a project that cannot be resolved, the response is ended cleanly — which the dashboard reads as a finished stream rather than a lost one. When the dashboard disconnects or errors, the underlying source is released.

Where the events come from depends on the agent: an agent relayed from a connected device streams from the daemon's in-memory relay stream; an ordinary local agent falls back to tailing its own event log.

#### Rationale

The stream sends plain server-pushed lines rather than using a bidirectional channel abstraction. The abstraction offered serialization, typing and reconnection, but the dashboard only ever needs "push me lines until I go away", and its reconnect logic had to be rebuilt on top anyway because the abstraction's own could not tell a dead daemon from a finished stream — the exact distinction that matters here.

### Calls, failures and limits

#### User story

The dashboard fires actions constantly; a single bad one must never take the daemon down or leave the user staring at a hung request.

#### Business logic

A call names an action in its path and carries its arguments as a JSON array. An unknown action, or one requested with the wrong method, is answered as not found — including names that are not real actions but happen to exist on every object, which an unauthenticated caller could otherwise use to reach something that was never meant to be callable. A body that is not an array of arguments is refused as a bad request. An action that throws is answered as a failed call carrying a readable message, and the daemon keeps running — without this, a rejected call inside the mount became an unhandled crash. Request bodies are capped, so a misbehaving caller cannot make the daemon buffer without limit.

Every action acts through one wired set of capabilities: starting an agent, adding a project, the relayed-agent lookup and its event stream, the user's preferences, the quota source behind the usage panel, the Discord credentials, what Auto PM last decided and how to run a sweep now, and each project's current errors.

#### Rationale

All of those capabilities are mandatory. They used to be optional because three different hosts served this same surface, each wiring a different subset — so every action carried an "unavailable here" branch and the dashboard rendered a matrix of degraded states. There is one host now, and it wires all of it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
