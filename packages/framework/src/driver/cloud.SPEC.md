Hands an agent's task to Claude Code on the web: has a cloud session created on claude.ai — by the browser extension, in the user's own browser, on this run's pushed starting point — and reports where the work went.

## User story

The user picks "Claude Code on the web" as where an agent runs. The work should happen on Anthropic's infrastructure at no local cost, under the user's own account and quota, and land as a pull request — without the user doing anything on claude.ai. When something the hand-off needs is missing, the run should say exactly what.

## Glossary

- **hand-off anchor** - an empty commit The Framework pushes just before handing a task to a cloud session. It marks exactly where that session started from, under a name that is recognizably this run's, so the session's branch can be told apart from one a person made.

## Business logic — TL;DR

- **The browser extension creates the session** - the run asks its daemon to queue a request naming the repository, the pushed starting point and the prompt; the extension creates the session through claude.ai's own repository picker, so the session is bound to the repository and can push and open its pull request.
- **The user's own account does the work** - the session is created in the user's signed-in browser, so the account, the sign-in and the quota are the user's, as with a local agent.
- **What the hand-off needs is named when missing** - a daemon that started the run, a GitHub remote, the browser bridge switched on, and the extension present: each absence stops the run with that as the message.
- **The starting point is pushed first, under a name the cloud side can resolve** - the session is told exactly which ref to open on, and that ref doubles as the run's identity on the remote; a push that fails stops the run.
- **One agent, exactly one cloud session** - the first prompt hands off; every later prompt says the work is already over there and spends nothing.
- **The hand-off prompt is written for a human to read** - the task comes first, and everything The Framework injects follows behind a labelled rule.
- **The turn ends the moment the session exists** - there is no way to read back a cloud session's progress, so the turn's result is the link, and following the work happens through the bridge's mirror or on claude.ai.

## Business logic

### The browser extension creates the session

#### User story

See `## User story`.

#### Business logic

After the starting point is pushed, the run asks its daemon to queue a session request: the repository as `owner/name` (read from the checkout's GitHub remote), the pushed starting-point ref, and the whole hand-off prompt. It then follows the request until the extension reports the session, and reports the session's link and id exactly as before. An extension that tried and could not create the session stops the run with the extension's own note of what it could not find.

#### Rationale

A session created through the page's repository picker is bound to the repository. The CLI's own cloud mode, the earlier mechanism, produced on some accounts a bundle upload that could never push (#1320), and it could vanish from the CLI at any release; the extension path is the one that ends in a pull request, and it is the only one now.

### What the hand-off needs is named when missing

#### User story

The user starts a web run on a machine or project that is not set up for it. They should learn in one sentence what to do, not wait for a timeout.

#### Business logic

Four things are checked, in this order, each stopping the run with its own message: the run was started by a daemon (a run started any other way has nobody to hand its session to — web runs start from the dashboard); the project has a GitHub remote for the picker to name; the daemon's browser bridge is on; an extension has spoken to the daemon recently. A wait past the hand-off's timeout also stops the run, naming the extension.

### The starting point is pushed first, under a name the cloud side can resolve

#### User story

The cloud session must start from exactly where this run stands, and the run must be able to recognize the session's branch later.

#### Business logic

Before the request, the hand-off anchor — an empty commit on top of the checkout's current state — is pushed to the remote under the run's own slash-free identifier, and the request names that ref as the branch to open on. The anchor is recorded on the run's result. A push that fails stops the run, naming the remote: the session cannot open on a ref the remote does not have.

### One agent, exactly one cloud session

#### User story

The agent loop may prompt the same agent several times; the user must never end up with two cloud sessions for one task.

#### Business logic

Only the first prompt creates a session. Every later prompt reports the same session and says the work is already there, and the session link is published once.

### The hand-off prompt is written for a human to read

#### User story

Someone opens the cloud session on claude.ai and wants to see the task first, not The Framework's instructions.

#### Business logic

The prompt handed over leads with the user's task, followed by the built-in framing and any per-turn framing, each behind a labelled rule; a task with nothing injected is handed over bare.

### The turn ends the moment the session exists

#### User story

See `## User story`.

#### Business logic

The turn's result is the session's link and id; the link is also published as an action the dashboard links through to. A cloud session exposes no read-back — no status, transcript or output — so following the work happens through the browser bridge's mirror and gate relay, on claude.ai itself, or by pulling the session back with the CLI. There is no code reading either: the workspace lives in a cloud machine this one never sees.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
