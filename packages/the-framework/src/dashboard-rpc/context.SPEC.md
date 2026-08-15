How each dashboard call reaches the one host's capabilities, and which checkout a session-scoped call should act on.

## TLDR

- One host wires everything, so a capability is simply there. This used to be a probe: three hosts served this same surface — the dashboard process, a per-session foreground dashboard, and a public relay — each wiring a different subset, so every call read what it needed and every RPC carried a branch for the absent case. A missing capability is a wiring bug now, and says so.
- The one exception is "is this session relayed onward?", which defaults to no: a call arriving over the device relay runs outside a request, and the session it names is local to that device — forwarding it again would be a loop.
- A call that names a session resolves to that session's own checkout — where the session actually reads, writes, and listens — falling back to the project root only for a session that has none.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
