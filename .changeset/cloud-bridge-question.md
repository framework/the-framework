---
'@gemstack/the-framework': minor
---

A Claude web run can now show the question its cloud session is parked on, instead of leaving it stranded on claude.ai. A browser extension running in the user's own session reports the question to a new opt-in `/_bridge/question` endpoint, and the run view renders it. The question is keyed by cloud session id, which a web run already carries, so it lands on the right run even though the run itself ended at the hand-off. Off unless the `bridge` preference is set, and the route authenticates with its own bearer token rather than the non-loopback guard, since it is the one route meant to be reached from another origin. The first slice was read only; answering from the dashboard ships alongside in this release.
