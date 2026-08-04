The hosted run relay: ingest a run's event stream over HTTP and re-serve the same dashboard to any number of remote browsers keyed by run id, so people on different machines watch one run live.

## Decisions

- **Deliberately unauthenticated** — anyone with the URL can watch; the relay never runs an agent. A run publishes to it with `--share`.
- Read-only-ness is **structural, not a UI flag**: the relay wires an *empty projects provider* into the shared dashboard context, so every file/registry-backed RPC returns nothing on a public host. Only the live stream is exposed.
- Binds `0.0.0.0` by default — reachability is the whole point — unlike every other server in the package.

## Facts

- The watch view is the same prerendered dashboard bundle, opened in read-only watch mode with the run id in the URL.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
