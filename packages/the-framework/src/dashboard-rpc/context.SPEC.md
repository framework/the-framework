How each dashboard call reaches the one host's capabilities, and which checkout an agent-scoped call should act on.

## Flows

- One host wires everything at start-up, so a capability is simply there; a missing one is a wiring bug that says which capability is missing.
- The one exception is "is this agent relayed onward?", which defaults to no: a call arriving over the device relay runs outside a request, and the agent it names is local to that device — forwarding it again would be a loop.
- A call that names an agent resolves to that agent's own checkout — where it actually reads, writes, and listens — falling back to the project root only for one that has none.

## Rationales

- Treating an unwired capability as a bug is what keeps the calls simple: exactly one host serves this surface and wires all of it, so an absent-capability branch in every call would guard a state that cannot legitimately occur — throwing with the missing capability's name surfaces the wiring mistake instead.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
