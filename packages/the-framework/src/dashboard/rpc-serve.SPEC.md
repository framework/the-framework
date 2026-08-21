Mounts the dashboard's RPC surface on the daemon's server and keeps other websites out of it.

## User Stories

- The user's own dashboard page is the only website that can start or steer agents on their machine.
- The user watching an agent's live feed can tell "the agent finished" from "the connection dropped".

## Flows

- Two browser guards keep other websites out. A call from another website's page is refused: a page the user merely visited must not start or steer agents on their machine. Refused too is a request whose named host betrays the DNS trick that makes a hostile page look same-origin — the request carries the name the browser was asked for, not the address it resolved to, so a rebound name gives itself away.
- The RPCs run inside the daemon's own process, through wiring set once at start-up. That wiring carries every capability: there is no second host wiring a different subset, and nothing varies per caller.
- Calls are addressed by name over plain HTTP, and the live feed is Server-Sent Events.
- The feed's response simply ending is how a viewer tells "the server is done" from "the connection dropped" — the first is a finished agent, the second is worth retrying and worth saying out loud.
- A malformed request is answered, and so is one whose RPC throws: a failing call is a failing call, never a dead daemon. A name that is not an RPC is answered with "no such RPC" — including the built-in names every object carries (`constructor`, `toString`), which are not RPCs no matter that every object technically has them.

## Rationales

- Plain HTTP calls rather than an RPC framework: what a framework buys over them is type-safety across a package boundary, and the server and the dashboard app live in one package — there is no boundary to protect.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
