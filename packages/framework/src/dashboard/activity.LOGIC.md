Builds the activity [1] feed, the cross-project list of agents [2] that started or finished, and renders it for Discord: one item per recent agent of every registered project, keyed so that each start and each finish is announced exactly once, and posted to a Discord webhook as one message.

## Context

**User story**: with the "New activity" notification category switched on (it is off until the user turns it on), the user hears when an agent [2] kicks off and when it lands, as a browser notification or a Discord message, and hears nothing about what already existed when the page or the daemon started. It is the counterpart of the intervention [3] feed, which is always on and lists what needs a human.

**Business logic story**: the daemon's notification sweep [4] polls this feed and hands the genuinely new items to Discord (`../daemon-services.ts`); the dashboard polls the same feed for browser notifications. Both fold what they see into a per-project baseline and announce only what appears after it, by the rule in `keyed-watcher.ts`.

## Glossary

[1] activity: an agent started or finished — one of the two notification feeds; the other is intervention: something that needs a human.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds.
[4] sweep: a background job the daemon runs on its clock: Auto PM, the CI watch, the notification watchers, the sweep that reclaims checkouts, the branch-links sweep, the cloud scratch sweep, cloud work adoption.
[5] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.

## Business logic — TL;DR

- **One item per recent agent, as it stands now** - each of a project's 20 most recent agents yields one item: "started" while it runs, "finished" once it reached a terminal status, newest first across projects.
- **A project that cannot be read stays quiet** - an unreadable project contributes nothing and is not counted as read whole, so it earns no baseline and nothing is announced from a partial view of it.
- **Each start and each finish is announced once** - an item's identity is its kind, its project and its agent, so an agent notifies once when it starts and once when it lands, and a quick agent seen only finished notifies once.
- **How it reads on Discord** - a batch is one message: a started agent as "▶️ started: …", a finished one marked by its outcome, and an empty batch posts nothing.

## Business logic

### One item per recent agent, as it stands now

#### Context

See `## Context`.

#### Business logic

For every registered project, the project's agents [2] are read newest first, running ones ahead of finished ones, and only the 20 most recent are considered: older agents rolled off long ago and were already baselined, and a running agent is always among the newest. Each agent becomes one item reflecting where it is now: kind "started" while its status is running, kind "finished" once it reached a terminal status, and a finished item carries that status (done, stopped [5] or failed) so a stop reads differently from a completion. The item names the project, the agent, and what the agent was asked for as its title, when it was asked for anything. Items are ordered newest first by the moment the agent last changed, across all projects.

### A project that cannot be read stays quiet

#### Context

**Problem**: "nothing happened there" and "I could not look" are the same empty list to everyone but the notification watcher, whose baseline must come from a real read: a first look that could not reach a project would otherwise make the next successful look announce everything pre-existing as new.

#### Business logic

A project whose agents [2] cannot be read contributes no items and is left out of the list of projects read whole. A project that was read and simply has no agents is read whole, with nothing in it. The feed returns both: the items, and the projects whose share of the items is complete.

### Each start and each finish is announced once

#### Context

See `## Context`.

#### Business logic

An item's identity is its kind, its project and its agent [2] (`started:<project>:<agent>` or `finished:<project>:<agent>`, the rule shared with the dashboard in `keys.ts`). The "started" and "finished" items of one agent therefore carry distinct identities: an agent still going notifies once as started, and again when it lands. An agent that both starts and finishes between two looks is only ever seen finished, so it notifies once — one quick agent, one line.

### How it reads on Discord

#### Context

**User story**: the user pasted a Discord webhook into the dashboard and switched the "New activity" category on for Discord; each batch of new items arrives as one message.

#### Business logic

One item renders as one line: "▶️ started: <title>" for a started agent [2]; "✅ finished: <title>" for a finished one, "❌ finished: <title>" when it failed and "⏹️ finished: <title>" when it was stopped [5]; an agent with no title reads as "a session". A batch of one posts "📣 Activity (<project name>): <line>"; a batch of several posts "📣 <count> session updates:" followed by one "• <project name>: <line>" per item. An empty batch posts nothing and counts as delivered. The post goes through the one Discord webhook transport in `discord-webhook.ts`, and the result says whether Discord accepted the message, so the daemon can log a batch that did not get through.
