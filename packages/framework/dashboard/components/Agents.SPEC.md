The Overview's Agents card: every agent working right now, across all projects, each row a link straight into that agent.

## Business logic — TL;DR

- **Only what is working now** - the card lists agents currently working, a cloud session's agent included while the session works or waits; finished agents are not repeated here because the sidebar already lists them.
- **A row opens the agent itself** - clicking a row goes to that agent in its project, never merely to the project's launcher.
- **Each row names the agent the way the sidebar does** - its intent, else its session name, else its scope, else its project.

## Business logic

### Only what is working now

#### User story

The user wants one place that answers "what is being worked on right now?" without opening each project.

#### Business logic

The card pools the currently working agents from every project. An agent whose cloud session is still at work is among them, its row saying "in cloud" or "waiting" since no local process backs it. While the list is still being fetched it says so; when nothing is working it says no agents are working right now. Finished agents are deliberately absent — the sidebar's agent list already holds them, so a second copy here would say nothing new.

### A row opens the agent itself

#### User story

The user sees an agent working and wants to read what it is doing.

#### Business logic

Every row is one clickable line that opens that agent in its project. The row carries no hint text of its own: that an agent row opens the agent is the one thing this card already says.

### Each row names the agent the way the sidebar does

#### User story

The user recognises an agent in this card by the same wording they see everywhere else.

#### Business logic

A row shows the agent's one-liner, its project's name, "from" and the machine's name when another machine's daemon started it, and how long ago it was last active, with the exact date and time on hover. The one-liner is the agent's intent, falling back to the session name it chose for itself, then to its scope, and finally to its project's name — a working agent almost always has an intent or a chosen name.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
