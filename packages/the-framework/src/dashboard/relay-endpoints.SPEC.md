The device side of running an agent on another machine: the few endpoints a daemon exposes so a trusted peer daemon can start an agent here, watch its events, and make agent-scoped calls.

## User Stories

- The user starts an agent on this machine from another machine's dashboard and watches it there, live.
- The user's device list on the other machine shows whether this machine is reachable.
- The user's device is not open to strangers: every relay call needs the device's token.

## Flows

- Everything sits behind the device's shared token — the one guard fronting every route of a network-reachable daemon — so a caller without it is refused before reaching any of this.
- The online dot the user sees is a reachability ping here: it answers even when the relay is not wired and starts nothing — it only proves "I'm here and your token works".
- A relayed start strips any nested relay target, so an agent can never be relayed onward to a third machine.
- Agent-scoped calls go through one channel that admits only named, whitelisted operations. Events stream back as a plain line-by-line feed until the agent ends or the caller hangs up.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
