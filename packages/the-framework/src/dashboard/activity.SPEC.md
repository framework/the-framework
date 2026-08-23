The "new activity" feed: the cross-project stream of agent lifecycle transitions that do not need the human — an agent started, an agent finished. It is the default-off notification category, the counterpart to interventions (the always-on "needs you" list). Both notifier paths — the browser notifications and the Discord watcher — fold the feed into a baseline on first look and then announce once per transition, so the user hears an agent kick off and an agent land, and hears nothing merely because the dashboard page or the daemon started.

## Business logic — TL;DR

- **One item per agent, reflecting where it is now** - across every registered project's 20 most recent agents: an item reads `started` while the agent runs and `finished` once it reaches a terminal status — carrying that status, so a stopped agent reads differently from one that completed. Items are titled by what the agent is building (its intent) and ordered newest first.
- **Each transition announces exactly once** - an agent's start and its finish carry distinct identities, so a long-running agent produces two notifications (kick-off, landing). An agent that starts and finishes between two polls is only ever seen terminal, so it produces one (finished) — one quick agent, one line.
- **"Could not look" is not "nothing happened"** - a project whose agents cannot be read contributes no items and is excluded from the list of projects read whole, so the notification watchers never mistake a failed read for a quiet project. A project that simply has no agents yet still counts as read whole. Surfaces that merely render the list ignore the distinction.
- **Discord delivery** - the given items go out as one webhook message: a single item names its project and reads as one line; several items collapse into a counted summary with one line per item. A finished item's line is marked by its outcome (done, failed, or stopped). An empty list posts nothing at all, and the caller learns whether Discord accepted the message.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
