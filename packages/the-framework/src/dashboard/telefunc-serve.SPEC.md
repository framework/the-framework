Mounts the dashboard's RPC surface on the daemon's server and keeps other websites out of it.

## TLDR

- Two browser guards: calls from another website's page are refused (it must not start or steer runs on the user's machine), and so are requests whose named host betrays the DNS trick that makes a hostile page look same-origin.
- The RPCs run inside the daemon process and reach the daemon's own capabilities through a per-host context — each host wires only what it means to expose, and an unwired capability is simply inert.
- A malformed request is answered, never allowed to crash the daemon.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
