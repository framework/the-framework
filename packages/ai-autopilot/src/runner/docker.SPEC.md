The runner that boots each workspace as a Docker container, so untrusted agent-written code runs isolated from the host — its own filesystem, its own processes, and a preview port mapped out to the machine.

## TLDR

- It drives everything through the machine's Docker installation and needs nothing else; disposal force-removes the container, which reliably stops everything inside and frees the port.
- The preview port is fixed when the workspace boots, because Docker maps ports at container start; asking for a different one later is a clear error rather than a silent dead URL.

## Rationales

- Server readiness is probed from inside the container: Docker's host-side proxy holds the published port open before the real server is up, so probing from outside would report ready too early.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
