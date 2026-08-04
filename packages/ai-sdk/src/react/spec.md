React bindings (`./react` subpath): `useAgentRun` drives a run from a component across pause/resume round-trips.

## Facts

- The real state machine is framework-free and exported separately (`driveAgentRun`): request → read the SSE stream → if parked on client tools *and* a resolver is configured, auto-execute and resume; otherwise return the turn. **Approval pauses never auto-resume** — they always park for an explicit human decision.
- The hook keeps `status: 'running'` while parked, surfacing pending client tools and pending approval — one logical run across many HTTP round-trips.
- The app owns the endpoint and request body: only the app's route can reconstruct server-side history, so the driver hands over a typed intent, not a request.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
