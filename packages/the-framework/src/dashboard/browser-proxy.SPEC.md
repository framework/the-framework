Carries the browser preview between the dashboard and the agent: the daemon relays the agent's live Chrome frames to the pane in the dashboard, and the user's clicks and keys back to that Chrome.

## User story

An agent hits a login wall or a captcha it cannot get past on its own. The user opens the browser preview in the dashboard, sees the agent's Chrome as a live picture, and clicks and types into it to get the agent through — without ever leaving the dashboard.

## Business logic — TL;DR

- **The daemon is the only way in** - the pane talks to the daemon on the dashboard's own address; the daemon talks to the agent's Chrome on loopback.
- **The agent names its own port, never the caller** - a request identifies a project and an agent, and the port is read from that agent's own record.
- **Only a running agent has a preview** - anything else answers "no browser preview", which is an ordinary answer, not an error.
- **Frames stream, they are never buffered** - the picture is an endless stream, so anything waiting for it to end would never answer.
- **An unrecognised address is not this feature's** - it falls through to the dashboard's own app instead of being guessed at.

## Business logic

### The pane reaches the agent's Chrome only through the daemon

#### User story

The user watches and drives the agent's Chrome from the dashboard.

#### Business logic

The dashboard's browser preview requests two things under `/browser/<project id>/<agent id>/`: `stream`, the live picture, and `input`, one click or key on its way back to the agent's Chrome. The daemon forwards each to the agent's Chrome on loopback and pipes the reply straight back. Frames are marked as never cacheable, since they show whatever the user is typing right now.

#### Rationale

The agent serves its own browser preview on a port the operating system picks per agent, deliberately reachable only from this machine. The dashboard is served from a different address, so it cannot talk to that port directly without the agent's Chrome accepting requests from web origins — which would give up exactly the containment that keeping Chrome's debug port unreachable from the web buys. Routing through the daemon means the pane only ever talks to the dashboard's own address.

Critically, the caller never names the port: it names a project and an agent, and the port comes from that agent's own record. Without that, this would be an open relay to anything else listening on this machine.

### Which agents have a preview

#### Business logic

The port is taken from the record of the named agent inside the named project, and only while that agent is running. An unknown project, an unknown agent, an agent that never opened a browser, and a finished agent all answer "no browser preview for this run".

The pane asks for the preview while an agent is still starting, and plenty of agents never open a browser at all, so a miss is an ordinary outcome rather than something worth reporting as a fault.

#### Rationale

A finished agent's port is refused rather than tried because the browser preview dies with the agent: reusing its recorded number would reach whatever the operating system handed that number to next.

### Failures and disconnects

#### Business logic

An address that does not have the expected shape — including one carrying a malformed escape — is not treated as a browser preview request at all; it falls through to the dashboard's own app, like any other unrecognised address, rather than failing.

If the agent dies mid-stream, the pane is answered with a gateway failure. When the pane goes away, the daemon stops pulling frames from the agent immediately, so an agent never keeps serving a viewer that is gone.

#### Rationale

A malformed address is swallowed rather than thrown because this handler runs outside any request's error handling: a failure escaping it would take the whole daemon down.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
