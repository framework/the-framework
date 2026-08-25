What a `web`-target agent's cloud session is doing, read off the agent's record: the one rule every surface uses to label such an agent once its local half is over.

## User story

A user hands a task to Claude web and later glances at the dashboard. The agent's row should say what a local agent's row would say — working, waiting on them, its pull request, merged, or done — not "in cloud" forever.

## Glossary

- **session window** — the 12 hours after an agent's start during which its cloud session is assumed to still be alive; the same window the browser bridge watches a session for (`bridge-sessions`).

## Business logic — TL;DR

- **Only a settled web agent has a cloud state** - a local agent, or a web agent still handing off, stopped or failed, keeps its stored status as its word.
- **Waiting beats everything** - the browser bridge reporting the agent's session as waiting on a human — it holds the session's parked question, or claude.ai's session list shows the session awaiting input — makes it "waiting", however old the agent is.
- **Adopted work speaks as a local agent's would** - a pull request merged by the framework reads "merged"; any other recorded pull request means the agent is "done", its pull request badge carrying the live state.
- **Otherwise age decides** - inside the session window with no pull request the session is "in cloud"; past it, the agent is "done" — the session finished or never pushed.
- **At work means in cloud or waiting** - those two states count the agent among the agents working now; the settled ones do not.

## Business logic

### The state of a web agent's cloud side

#### User story

See `## User story`.

#### Business logic

The rule applies only to a `web`-target agent whose status is done — done being what the hand-off leaves behind, since the local half ends the moment the task is handed over. Any other agent has no cloud state and its status is the word.

For such an agent, in this order: if the browser bridge reports the session waiting on a human — it holds the session's parked question, or claude.ai's session list shows it awaiting input — the agent is waiting; else if the framework merged its pull request, it is merged; else if it has a pull request, it is done — the pull request's own state is not on the record and is read live wherever its badge shows, so the word is the same a local agent with a pull request gets; else if the agent started within the session window, the session is assumed to be still working and the agent is in cloud; else it is done. A start time that cannot be read counts as outside the window — "in cloud forever" is the lie this rule exists to end, so the doubt resolves to done.

#### Rationale

The record on disk cannot know whether the session is parked: the bridge's questions and list statuses live only in the daemon's memory. So the daemon marks the agent as waiting on the way to the dashboard, and this rule reads that mark; it never reads the bridge itself, which keeps it pure and lets the browser, the rail and the Overview derive the same word.

The session window is the bridge's, not adoption's 48 hours: past the bridge's window nothing could ever learn the session is parked, so "in cloud" would be a guess nobody can correct, while adoption keeps asking for longer because a branch pushed late is still a fact worth recording.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
