The accounting every agent shares, whichever way it was started: announce the agent's session, turn the driver's own event stream into the agent's event log, keep the running usage total, and decide whether an agent that ended early was stopped or failed.

## Business logic — TL;DR

- **The agent announces its session up front** - the opening event names the driver, the workspace, the model, and whether this is the fake driver; a session link the framework can already resolve is shown immediately.
- **The real session id is surfaced as soon as it is known** - the driver's own session id becomes the agent's honest handle, re-announced whenever it changes, with the link that goes with it.
- **A driver's own session URL beats the framework's template** - when the driver knows the real address of its session, that address is used instead of the configured link template.
- **The hand-off anchor is published as an event** - the commit a hands-off agent was handed off from travels through the agent's event log, because that is the only way it reaches the daemon after the agent's process is gone.
- **Usage totals grow turn by turn** - each turn's usage folds into the agent's running total, which is republished after every turn.
- **A running agent is never stopped over spending** - the only self-stop left is the user answering a gate with a stop option; a caller's Stop, Ctrl-C or control-channel stop is composed with it so everything downstream reacts identically.
- **Stopped and failed are told apart the same way everywhere** - a caller interrupt or a stop answer ends the agent as stopped; anything else is a real failure, with its own message.

## Business logic

### The agent announces its session up front

#### User story

The moment an agent starts, the user wants to see which driver is working, in which workspace, with which model — and, for the demo driver, that this is not a real coding agent at all.

#### Business logic

The agent's first event names the driver, the workspace it works in, the model the driver was started with, and flags the fake driver as fake. When the session link is a plain address that needs nothing filled in, it is shown right away. When the link is a template that needs the driver's session id, nothing is shown until the driver reports that id.

### The real session id is surfaced as soon as it is known

#### User story

The user wants to open the agent's underlying CLI conversation from the dashboard, which needs the session's real identifier — and that identifier changes from prompt to prompt.

#### Business logic

Whenever the driver reports a session id that differs from the last one seen, the agent publishes the new id together with the session link it resolves to. The driver announces its session id at the start of a turn as well as at the end, and that early announcement is used only to publish the id — it never appears as its own row in the agent's transcript, both because it exists so the id lands before a Stop or a crash can lose the turn, and because a transcript row repeating an id that the very next event also carries would be pure noise.

### A driver's own session URL beats the framework's template

#### User story

An agent hands its task to a Claude Code cloud session. The dashboard should link to that actual session, not to a generic entry page.

#### Business logic

When a driver reports the real address of the session it created, that address is used as the session link. The configured link template is only used when the driver does not know one — for Claude Code its default resolves to a generic entry point, which is strictly worse than the real address.

### The hand-off anchor is published as an event

#### User story

An agent hands its task to a Claude Code cloud session. Later, adoption has to find the branch that cloud session actually created and match it back to this agent — which it does by ancestry from the commit the hand-off started at.

#### Business logic

When a turn reports the commit it handed the task off from, that commit is published on the agent's event log. It reaches the agent's status record the same way the session id does: it is a fact about the agent that the daemon needs after the agent's process is gone, and only an event carries it that far.

### Usage totals grow turn by turn

#### User story

The user wants to see what an agent has spent so far, updated as it works, not only when it finishes.

#### Business logic

Every turn that reports usage folds into the agent's running total, and the new total is published as soon as it changes. Usage is what this agent spent; it is not the account's quota.

### A running agent is never stopped over spending

#### User story

The user presses Stop, or answers one of the agent's questions by picking an option that means "stop here". Either way the agent stops, and everything watching it reacts the same way.

#### Business logic

The agent runs under one stop signal that combines the caller's — the dashboard's Stop button, Ctrl-C, or a stop arriving on the control channel — with the single self-stop that remains: the user answering a gate with an option the agent marked as stopping. Everything downstream watches that one signal, so it behaves identically whichever source fired.

#### Rationale

There used to be three ways an agent stopped itself. A per-agent spending cap and a mid-agent quota check also aborted an agent that was already running, which is the worst possible moment to economise: the tokens are already spent, the work is half-done, and what is saved is the cheap part while what is lost is the expensive part. Spending is now decided once, before an agent starts. The stop that survives is the one a person actually asked for. It used to be reached through the kind of gate being declined; it is now reached through the option the agent itself marked as stopping, which is the same stop without the plan-approval special case.

### Stopped and failed are told apart the same way everywhere

#### User story

A user who pressed Stop should see the agent as stopped, not as broken. A user whose agent genuinely failed should see why.

#### Business logic

An agent whose work ended early is reported as stopped when the caller interrupted it or when the user's answer said to stop; every other ending is a real failure. An agent stopped by an answer says so; a failure reports the underlying error's own message. The same rule serves every way an agent can be started, so the two paths can never disagree on what "stopped" means.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
