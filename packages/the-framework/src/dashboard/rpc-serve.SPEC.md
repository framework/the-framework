Mounts the dashboard's RPC surface on the daemon's server and keeps other websites out of it.

## TLDR

- Two browser guards: calls from another website's page are refused (it must not start or steer agents on the user's machine), and so are requests whose named host betrays the DNS trick that makes a hostile page look same-origin.
- The RPCs run inside the daemon's own process and reach its capabilities through wiring set once at start-up, which carries all of them — there is no second host to wire a different subset, and nothing about the wiring varies per caller.
- Calls are addressed by name over plain HTTP, and the live feed is Server-Sent Events. There used to be an RPC framework here: it needed a build-time transform over every RPC file, a registration table pinning each call to the client-baked path of the file it was re-exported from, and a shim per module to keep those paths stable. What it bought was type-safety across a package boundary that no longer exists.
- The feed's response simply ending is how a viewer tells "the server is done" from "the connection dropped" — the first is a finished agent, the second is worth retrying and worth saying out loud.
- A malformed request is answered, and so is one whose RPC throws: a failing call is a failing call, never a dead daemon. A name that is not an RPC is one of those answers, including the names every object carries whether anyone registered them or not.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
