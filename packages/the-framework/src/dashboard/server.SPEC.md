The dashboard's front door: one small web server that serves the app, mounts its RPC surface, and routes the special channels — browser preview, device relay, cloud-session bridge.

## TLDR

- Bound to this machine only by default; on a reachable address one shared token guards every route, because a daemon that spawns processes on an open port is remote code execution. A valid token in a link becomes a cookie and leaves the URL after one hop.
- The cloud-session bridge is the only route in front of that guard: it is meant to be called from another origin, so it authenticates with its own token instead.
- One host, wiring everything: there is no second dashboard to serve a single session on its own port, so nothing here is optional and no call has to ask what this server can do.
- A broken install with no built app answers "not installed" everywhere rather than standing up half a dashboard, and malformed requests are answered, never allowed to crash the process.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
