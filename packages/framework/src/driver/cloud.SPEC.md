The driver for the `web` run target: instead of running a coding agent on this device, it hands the task to a cloud session on claude.ai and reports where the work went. This is the hands-off target — the task goes somewhere this machine cannot follow, so the hand-off is the whole agent.

## User story

The user wants a task done without it costing anything on their own machine — no CPU, no open laptop. They click the `web` run target, and the dashboard hands them a link to a real Claude Code session on claude.ai that does the work on Anthropic's infrastructure and opens its own pull request.

## Glossary

- **hand-off anchor** - an empty commit The Framework pushes just before handing a task to a cloud session. It marks exactly where that session started, so the branch it eventually pushes can later be recognized as this agent's.

## Business logic — TL;DR

- **The user's own account does the work** - the hand-off goes through the Claude Code CLI's own cloud mode, so the account, the sign-in, and the quota are the user's, exactly as for a local agent. Nothing here drives the claude.ai website: no browser, no extension, no scraping.
- **The browser extension creates the session when it can** - a run its daemon spawned asks the daemon for a session created through claude.ai's own repository picker, which is bound to the repository and can push and open the pull request; only when no extension is around, the bridge is off, the repository has no GitHub remote or the starting point could not be pushed does the CLI's own cloud mode hand off instead.
- **One agent, exactly one cloud session** - the first prompt hands off; every later prompt says the work is already over there and spends nothing.
- **The hand-off prompt is written for a human to read** - the task comes first, and everything The Framework injects follows behind a labelled rule.
- **The project is trusted on the user's behalf** - starting a `web` agent is itself the user's decision to trust the project, so Claude Code's one-time trust question is answered ahead of time instead of blocking the hand-off.
- **The starting point is pushed first, under a name the cloud side can resolve** - the session is told exactly which ref to clone, and that ref doubles as the mark that later identifies the branch it produces.
- **The turn ends the moment the session link appears** - there is no way to read back a cloud session's progress, so the turn's result is the link, and following the work happens on claude.ai, through the Claude web bridge where it is switched on, or by pulling the session back to this machine.
- **Nothing the user typed can be interpreted as a command** - the prompt and the model reach the CLI through the environment, never as part of a command line.

## Business logic

### The browser extension creates the session when it can

#### User story

The user runs the browser extension. Their web runs should land as sessions that can push and open pull requests, without them doing anything on claude.ai — and on a machine without the extension, web runs should still work.

#### Business logic

After the starting point is pushed and the project trusted, a run that knows its daemon's address asks the daemon to queue a session request naming the repository as `owner/name` (read from the checkout's GitHub remote), the pushed starting-point ref, and the whole hand-off prompt. It then follows the request until the extension reports the session, and hands off exactly as the CLI path does — the same link, the same summary, the same single hand-off per agent. Four things make the run hand off through the CLI's cloud mode instead, each announced in the agent's log: no GitHub remote to name in the repository picker; a starting point that could not be pushed, since the session must open on that ref; a daemon that answers no extension is around; or a daemon with the bridge off. An extension that tried and could not create the session fails the turn with the extension's own note of what it could not find — never a silent second attempt through the CLI. The wait shares the hand-off's overall timeout.

#### Rationale

A session created through the page's repository picker is repo-bound; the CLI's cloud mode has, on some accounts, produced a bundle upload that could never push (#1320). The extension path is the one that ends in a pull request, so it goes first, and the CLI path stays only for the machines and cases where it cannot run.

### One agent, exactly one cloud session

#### User story

See `## User story`.

#### Business logic

The first prompt creates the cloud session. Every prompt after it reports the hand-off that already happened — naming the session's link and how to continue it on this machine — without creating another one. The turn's wording makes clear that there is nothing further to do locally and that the cloud session opens its own pull request.

#### Rationale

An agent is not one prompt: the agent loop prompts again for each pass — plan, build, review, then the backlog loop. A driver that started a cloud session per prompt turned one agent into half a dozen independent cloud machines racing on the same repository. There is also nothing better on offer, because the wrapped CLI can create a cloud session and pull one back but cannot send it a second message; "this agent is already over there" is the honest answer.

### The hand-off prompt is written for a human to read

#### User story

The user opens the claude.ai session from the dashboard and wants to see the task they asked for, not a wall of framework boilerplate.

#### Business logic

The whole prompt is assembled task-first: the user's task, then each block The Framework injects — the system prompt framing and any per-turn framing — behind a hard horizontal rule and a single line naming The Framework as the source of what follows.

#### Rationale

For every other driver the framing is invisible plumbing. Here it is the first thing a human sees. Without the rules, the injected blocks' own markdown headings run into the task and into each other and read as one confusing document.

### The project is trusted on the user's behalf

#### User story

The user starts a `web` agent and it works. They should not have to discover, from an agent that timed out with nothing to show, that a dialog they cannot see is waiting for an answer.

#### Business logic

Claude Code asks once per directory whether the folder is trusted, and refuses to start until it is answered. That question cannot be answered by the daemon, so before handing off, The Framework records the project root as trusted the way the CLI itself would — starting a `web` agent on the project being the user's trust decision. Trust is recorded against the project root rather than the agent's worktree, because everything under a trusted directory inherits its trust and the worktree is thrown away.

If recording trust fails, the agent still proceeds and says so. The trust question is then watched for in the CLI's output, and if it appears the agent fails with the one-time manual fix spelled out — run `claude` in the project root once, accept the question, then start a new `web` agent — rather than with a generic "no cloud session was created".

### The starting point is pushed first, under a name the cloud side can resolve

#### User story

The cloud session has to start from the same code the user is looking at, and its eventual pull request has to be recognizable as this agent's work.

#### Business logic

Just before handing off, an empty commit — the hand-off anchor — is created on top of the agent's current checkout without moving any local branch, and pushed to the project's remote under a branch named after the agent. The cloud session is told to clone at that ref, and the anchor's identity is recorded on the agent so the daemon can later match the `claude/*` branch the cloud session pushes back to this agent by tracing its ancestry.

If the push fails — a repository with no reachable remote, for instance — the agent still hands off, falling back to the CLI's own default starting point, and warns that the cloud session may not find the branch and that its work would then have to be pulled back by hand.

#### Rationale

Two failure modes make an explicit ref necessary. The CLI's default is the checkout's current branch, and an agent worktree's branch exists only locally, so the cloud side cannot resolve it. And a branch name containing a slash never resolves on the cloud side even when it has been pushed. An agent's own identifier is unique and contains no slash, which sidesteps both.

An empty commit rather than the existing head is used because the cloud session names its own branch and does its own work; every commit it makes descends from what it cloned, so a commit unique to this agent is the one exact mark that identifies its branch afterwards.

### The turn ends the moment the session link appears

#### User story

See `## User story`.

#### Business logic

The CLI is watched until it prints the cloud session's link, at which point the link and the session id become the turn's result and the CLI is stopped — it has nothing further to say and would otherwise sit holding its terminal. The result carries the session id, the session link, and the hand-off anchor onto the agent's record, and the link is also published as an action the dashboard's agent view links through.

The hand-off gives up after two minutes. The user pressing Stop, the trust question appearing, and the CLI simply failing each produce their own distinct message; a plain failure carries the tail of the CLI's own output so the reason is visible.

There is no reading of files from a `web` agent: its workspace lives in a cloud machine this device never sees. There is no quota reading either — a cloud session draws on the same subscription a local agent already reports. What the session then does reaches the user on claude.ai itself, or — where the Claude web bridge is switched on — mirrored into the dashboard along with any question the session parks on, which is a separate subsystem entirely and nothing this driver reads.

### Nothing the user typed can be interpreted as a command

#### User story

See `## User story`.

#### Business logic

Cloud mode refuses to run unless it is attached to a terminal, so the CLI is run under one. The command it is given is a fixed, unchanging string; the prompt, the chosen model, and the ref to clone all reach it through the environment, so no text a user or an agent wrote can be read as command syntax. A model name that is not a plain identifier is refused outright before anything is started.

#### Rationale

Two details of that command are load-bearing and not otherwise visible. The task description must come immediately after the cloud flag, because it is that flag's own value rather than a loose argument — anything placed in between claims the slot and the CLI refuses to start, which is why the hand-off failed only for accounts with a model preference. And the CLI's non-essential traffic is switched off, which disables a server-side experiment that silently converts a failed repository preflight into a session with no remote and no ability to push — the exact opposite of what handing work to the cloud is for.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
