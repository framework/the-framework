The dashboard's front door: one small web server that serves the app, mounts its RPC surface, and routes the special channels — browser preview, device relay, cloud-session bridge.

## User Stories

- The user runs the dashboard with defaults and it is reachable from this machine only.
- The user binds the dashboard to a network address and shares its tokened link; a visitor without the token is refused on every route — nothing to see, nothing to do.
- The user follows the tokened link once; after one hop the token is out of the URL and a cookie keeps them in.

## Flows

- The default bind is this machine only. When the user binds a reachable address, one shared token guards every route, because a daemon that spawns processes on an open port is remote code execution. A valid token in a link becomes a cookie and leaves the URL after one hop.
- The cloud-session bridge is the only route in front of that guard: it is meant to be called from another origin (the user's browser extension reporting a cloud session's question), so it authenticates with its own token instead.
- One host, wiring everything: there is no second dashboard to serve a single agent on its own port, so nothing here is optional and no call has to ask what this server can do.
- A broken install with no built app answers "not installed" everywhere rather than standing up half a dashboard. Malformed requests are answered, never allowed to crash the process.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
