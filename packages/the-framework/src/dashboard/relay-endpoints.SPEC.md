The device side of running an agent on another machine: the few endpoints a daemon exposes so a trusted peer daemon can start an agent here, watch its events, and make agent-scoped calls.

## TLDR

- Everything sits behind the shared-token guard, so a caller without the device's token is refused before reaching any of this.
- A reachability ping answers even when the relay is not wired and starts nothing — it only proves "I'm here and your token works", which is what the device list's status dots poll.
- A relayed start strips any nested relay target, so an agent can never be relayed onward to a third machine.
- Agent-scoped calls go through one channel that admits only named, whitelisted operations; events stream back as a plain line-by-line feed until the agent ends or the caller hangs up.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
