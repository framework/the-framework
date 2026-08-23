Carries a draft prompt — text typed towards a not-yet-started agent — from wherever it was written to the launcher that will start the agent, without ever leaving it in the address bar.

## Glossary

- **draft prompt** - the task text meant for the launcher's prompt box, produced somewhere other than the launcher itself.

## Business logic — TL;DR

- **A draft survives a device hop** - opening another device's dashboard can carry the typed prompt along in the link, so the user retypes nothing when they move the work to another machine.
- **The prompt leaves the URL immediately** - at dashboard boot the carried draft is moved into per-tab browser storage and stripped from the address bar, so the typed prompt never sits in the address bar, in browser history, or in a request's referrer.
- **In-app hops never touch the URL** - a click inside the dashboard that knows what the next agent should be about but lands on the launcher (a hot ticket with no agent of its own) stashes the draft directly, since that navigation never leaves the tab.
- **The launcher takes the draft exactly once** - reading it clears it, so reloading the page does not re-seed the prompt box with an old draft.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
