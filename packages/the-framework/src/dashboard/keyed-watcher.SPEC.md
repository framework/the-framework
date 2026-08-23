The daemon-side engine behind notifications: it polls a cross-project list and hands over only the items that are genuinely new, so the user is told about them once. One engine serves both the interventions list and the activity feed; they differ only in what they collect and in what makes two items the same item.

## User story

The user wants to hear about work needing them, or work that just finished, even when no dashboard tab is open — which is exactly what a Discord message buys over a browser notification. And they want to hear about each thing once: not again on the next poll, and not about everything that already existed when the daemon started.

## Business logic — TL;DR

- **Only new items are announced** - each item has a stable identity; an item already recorded is never announced again.
- **What already existed is never announced** - a project's items only become announceable after that project has been read completely once.
- **The record is kept per project** - a project that cannot be read stays quiet until it can, without silencing the others or being handed a baseline it did not earn.
- **A partial read still counts against the record** - anything a poll did see is recorded, so the user never hears about it later as if it were new.
- **Failures cost nothing** - a poll that could not list the projects, or could not build the list, simply announces nothing that cycle.
- **No clock of its own** - the daemon's shared tick drives the poll, so the cadence is declared where every other background job's is; polls never overlap, and stopping the watcher ends both the polling and any announcement in flight.

## Business logic

### Only genuinely new items are announced

#### User story

The interventions list and the activity feed are both rebuilt from scratch on every poll, so every open pull request and every finished agent reappears each time. The user must be notified about each of them exactly once.

#### Business logic

Every item carries a stable identity supplied by whoever is being watched — what makes two items "the same" is a property of the thing being watched, not of the poll. Each poll records every item it saw; an item whose identity was already recorded is never announced again.

### Nothing pre-existing is ever announced

#### User story

The user starts the daemon on a project with twelve open pull requests. They must not receive twelve notifications.

#### Business logic

A project's items only become announceable once that project has been read *completely* at least once. The list being polled reports which projects it managed to read whole, as opposed to which it merely reached; only those projects earn that standing, and until a project has it, its items are recorded silently.

The record is kept per project rather than once for the whole poll. A poll that reached three projects out of four knows what already existed on those three and knows nothing about the fourth, and whether to announce is a per-project decision anyway.

#### Rationale

Held for the whole poll instead of per project, a single project that can never be read — a registered repository with no remote is an ordinary case — would either silence every project's notifications forever, or hand the entire set a baseline it had not earned, so the next good poll would announce everything pre-existing as new.

Items from a partially-read project are still recorded, because a partial read can only miss things, never invent them: whatever it did see is something the user should not later hear about as news.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
