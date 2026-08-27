The dashboard's summary of an agent, derived entirely from that agent's event log: the session name its branch carries and whether it is ready for merge, the errors it reported, what it is armed to publish and how that turned out, and the wrapped CLI session behind it.

## Business logic — TL;DR

- **Every summary is a projection of the event log** - nothing is stored beside the agent's events, so a live agent and a reopened finished agent show the identical summary.
- **Lifecycle progress: named, then ready** - the summary carries the session name read off the agent's latest observed branch and whether it has signalled ready for merge, which is what the dashboard's status label and dot show.
- **Errors accumulate, oldest first** - every error the agent reported stays in the list, so the dashboard can show a count and the latest headline.
- **The handoff is shown armed, then resolved** - what the agent will do with its work when it ends — push, open a PR, merge — and, once it has ended, whether that was done, skipped or failed.
- **The wrapped session survives its worktree** - the driver, the workspace, the model, the session id and the deep link all come from events, which is what still works after the agent's checkout has been removed.

## Business logic

### Every summary is a projection of the event log

#### User story

A user opens an agent that is still running, and later reopens the same agent long after it finished. Both views must tell the same story.

#### Business logic

Each part of the summary is computed purely from the agent's own event stream — the same stream the transcript renders — so the live dashboard and a replay of a finished agent produce the identical summary. Nothing is kept as separate state, and the derivation is checked against the real event shapes rather than living inside the dashboard.

### Lifecycle progress: named, then ready

#### User story

The user watches an agent go from "still building" to "ready for merge", and wants to see the name the agent gave its task.

#### Business logic

The summary reports the session name the agent's latest observed branch carries — none while it is still on its birth branch — and whether the agent has signalled ready for merge. The dashboard shows this as its status label and dot: orange while building, green once ready. An agent that has done neither reports no session name and not ready — there is always an answer.

### Errors accumulate, oldest first

#### User story

The user wants to see at a glance that an agent hit three problems, and what the most recent one was.

#### Business logic

Every error the agent reported is collected in the order it happened, each with a one-line headline and, when the agent wrote one, the detail of what it ran and what that said. The list only grows, because an error is something that happened; reopening a finished agent therefore shows exactly what it showed while it was running.

### The handoff is shown armed, then resolved

#### User story

Before an agent finishes, the user wants to know what it is going to do with its work; afterwards, what it actually did and where the result is.

#### Business logic

The summary states whether the agent will push its branch, whether it will open a PR (which implies pushing), and whether it will merge that PR. The user can change the push and PR arming while the agent runs, and the latest arming wins. Merging is armed at launch only and never changes mid-agent.

Once the handoff has run, the summary also reports how it ended: done — with the resulting URL when there is one — skipped with the reason, or failed with the error. While the agent is still going, there is no result yet.

#### Rationale

Push and PR are treated as armed by default, so an agent whose stream predates the arming event reads as armed — which is what it will actually do. Merging defaults to off for the mirror-image reason: merging is opt-in, and a stream from before merging was recorded must never read as an agent that will land on the default branch by itself.

The arming can also be seeded from the agent's own status record. The agent writes its arming as its very first event, before a live view can have attached, so a freshly opened tab can only learn the real arming from that record — without the seed, an agent the launcher armed push-only would read as "will open a PR". An arming event in the stream always wins over the seed, because it is newer than any record snapshot.

### The wrapped session survives its worktree

#### User story

Long after an agent finished, the user wants to open the coding agent's own conversation, or resume it — which needs both the session id and the directory the agent ran in.

#### Business logic

The summary names the driver, whether it is the fake driver, the workspace the agent ran in, and the model the current leg was started with; the session id and the deep link come from the latest session announcement, and the driver's own link — when it knows one — is what is shown. There is no session summary at all until the agent's session opens.

The workspace is taken from the event rather than from the filesystem: an agent that finishes cleanly has its worktree removed, so the event is the only surviving record of where the agent lived — and that path is exactly what resuming the coding agent's session needs to find it again.

Driver, workspace and model are folded per leg: the latest session announcement wins, and a leg that recorded no model clears it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
