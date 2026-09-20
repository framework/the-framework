Carries out every action the user takes on an agent [1] or a project from the dashboard: stopping an agent, answering its question [2], sending it a message [3], starting an agent, opening or merging its pull request, removing a retained checkout [5], deleting an agent, opening a checkout [6] in an editor, answering the question a cloud session [9] is parked on, and showing or restarting the bridge browser [10]. For each action: what is validated, what is refused and why, and what the browser gets back. An action about an agent relayed [11] to a device [12] is carried out on the device that runs it.

## Context

**User story**: on the agent view the user presses Stop, picks an option on a question's card, types a message in the composer, and, once the agent has ended, opens a pull request for it, merges it, removes the checkout it kept, or deletes the agent altogether. On the project home the user starts an agent from the launcher. (Putting a ticket on the agent queue, or freeing a ticket a dead agent still holds a claim on, is not a call here: it is the queue package's, or the tickets package's, own widget acting through its command, `widgets.ts`.) In Settings the user shows or restarts the bridge browser. Each of these is one call from the browser to the daemon, and this is what the call does before it answers.

**Business logic story**: the daemon runs no agent, so every action here reaches an agent through what the agent's tool reads. Events flow from the agent's process through its diary [13] to the browser; the other way, Start is the project's start hook [4], what the user says to an agent is a line in the agent's inbox [14] while it works and the project's resume hook [4] once it has ended, and Stop is a signal to the process the agent's card [13] names. The Framework names no tool in any of them.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] question: what an agent's turn ended on, asking the user to choose between options; the agent ends `waiting`, its checkout kept, and the answer resumes it.
[3] message: the user's own words to an agent, the next prompt of the same conversation.
[4] start hook / resume hook: the one shell line under `start`, and the one under `resume`, in a project's `.the-framework/hooks.yml`. The daemon runs the `start` line when the user presses Start and the `resume` line to continue an ended agent; each answers the agent's id as JSON on stdout.
[5] retained checkout: the checkout of an agent that has ended and is still on disk, kept so the user can inspect what the agent left; nothing removes it on a timer.
[6] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[9] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[10] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The bridge browser is the Chrome for Testing the daemon runs for it; the Driver tab is the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[11] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[12] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[13] card / diary: an agent's record in two shapes, defined by The Framework (`../store/runs.ts`): the card `<id>.json` (what was asked, the branch, the pull request, how it ended, what it cost) and the diary `<id>.jsonl` (what the agent said, one line per event). While the agent has a checkout they sit under the checkout's `.the-framework/`, written by the tool that runs it; a finished agent's are what the project's runs provider [26] answers.
[14] inbox: `.the-framework/inbox.jsonl` in an agent's checkout: one JSON line per message or answer, which the agent's session takes when a turn ends.
[16] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[17] pick: the answer to a question: the option or options the user chose.
[23] the Overview: the dashboard's cross-project page at `/`.
[26] runs provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's finished agents, and that removes a finished agent or sets its pull request (`../store/runs.ts`).
[30] branches provider: the package of the project that declares it provides the checkouts and branches; The Framework reads a branch's state and moves branches through the command that package declares (`../store/branches.ts`).

## Business logic — TL;DR

- **Stop is a signal** - the agent's card names the process running it; when that process is this machine's and alive, it gets SIGINT, and nothing is written; otherwise nothing happens.
- **A message to an agent** - trimmed, an empty one dropped; a line in the agent's inbox while the agent works, the project's resume hook once it has ended; refused in words when there is no such agent or no resume hook.
- **Answering an agent's question** - only the question the agent's own diary still holds open, only by its own options; the agent is handed the chosen labels, the same two ways as a message.
- **Answering the question a cloud session is parked on** - the pick is queued for the bridge's extension to type into the session, accepted only as labels of the question actually parked, and can be withdrawn until it is collected.
- **Starting an agent** - a non-empty prompt, trimmed, goes with the user's picks to the daemon's start, which runs the project's start hook; the answer is the new agent's id, or why there is none.
- **Removing a retained checkout** - refused while the agent is still going, for an unsafe id, for a checkout that is not there, and whenever the work is not yet on the remote; a clean checkout is pushed first and then removed.
- **Deleting an agent** - refused while the agent is still going; the checkout goes with whatever it holds, the finished agent's record goes through the runs provider [26], and its branch stays.
- **Opening a checkout in the file manager or an editor** - a local command against the agent's own checkout, or the project's; the editor is the one the preferences name, else the environment's, else VS Code.
- **Opening a pull request** - the agent's existing pull request is returned when it has one; a gone branch or an agent that committed nothing is refused; otherwise the branch is published through the branches provider [30], ready for review, and the pull request is recorded on the finished agent through the runs provider [26].
- **Merging** - an ended agent's open pull request is landed through the branches provider [30], and "already merged" is an answer, not an action; an agent still going has no Merge.
- **Controlling the bridge browser** - show, hide or restart; anything else is refused.
- **Actions about a relayed agent go to the device** - stop, a message, an answer, open pull request and merge are forwarded to the device that runs the agent; start, remove, delete and everything local-only never are.

## Business logic

### Stop is a signal

#### Context

**Problem**: an agent [1] is the process of a tool The Framework does not know. Its card [13], the file the dashboard shows it from, names the process running it. A signal reaches whoever runs the agent, and the daemon names no tool.

#### Business logic

The checkout the agent id [16] resolves to is read for its card. When the card says `running`, names a process id and this machine as its host, and that process is alive, the process gets SIGINT; a process gone between the check and the signal is not an error. Otherwise — a card that is missing, ended, from another machine or without a live process — nothing happens: there is nothing here to stop. Nothing is written anywhere. What the process does with the signal is its tool's own.

### A message to an agent

#### Context

**User story**: the user types in an agent's composer while it works, or long after it ended, and the same agent takes the words as its next prompt.

#### Business logic

The message [3] is trimmed and an empty one is dropped, answering success. An unknown project, no agent id, or an id unsafe for a path is refused with "unknown session". Otherwise the message is handed to the agent by the rule in `dashboard/run-inbox.ts`: a line in the agent's inbox [14] while the agent is working, else the project's resume hook [4] with the text. The answer is success, or the refusal in words, such as "this project has no resume hook" or the resume hook's own error.

### Answering an agent's question

#### Context

**User story**: an agent's turn ended on a question [2]; the user picks an option on its card, on the agent's page or in the questions hub, and the same agent goes on with that decision.

**Problem**: a pick [17] arrives from the browser as option ids. The agent must only ever be answered with what it offered.

#### Business logic

Same refusals as a message ("unknown session"). The agent's events are read (`store/agent-store.ts`) and the question the pick names must be one the agent still holds open by the shared rule (`open-choices.ts`); otherwise the answer is "that question is no longer open". Every picked id must be one of the question's options ("every pick must be one of the question's options"), and a question that is not a multi-select takes exactly one ("pick exactly one option"). The agent is then handed the question's title and the labels of the chosen options joined with ", " ("(none)" for an empty multi-select), by the same rule as a message: the inbox while the agent is working, else the project's resume hook with the labels as the answer.

### Answering the question a cloud session is parked on

#### Context

**Problem**: a `web` agent's work runs in a cloud session [9]; there is no local process to steer, and the agent itself is already over by the time the session asks anything. The question reaches the dashboard through the Claude web bridge [10], and the answer goes back the same way: queued for the extension, which types it into the session's composer and submits.

#### Business logic

The pick goes neither to an inbox [14] nor to a resume hook [4]: it goes to the bridge's store of parked questions, keyed by the cloud session's id. The id must look like a cloud session id (`session_` followed by up to 128 letters or digits), else the answer is refused as "unknown session"; the labels must be a list of non-blank strings, else "answer labels are required". The store then accepts only labels of the question that session is actually parked on, each at most once, and exactly one of them unless the question allows several; a refusal comes back with the store's reason ("that session has no parked question", "every label must be one of the question options", "pick exactly one option"). The text typed into the session is composed by the daemon from the chosen labels (the rules are `dashboard/bridge-store.ts`'s), so nothing arbitrary is ever put in front of another product's agent. A queued answer can be withdrawn; that is a no-op once the extension has delivered it or a Driver tab has collected it, and an id that is not a cloud session id is ignored. These two calls are never relayed [11]: the bridge lives on the daemon the extension talks to.

### Starting an agent

#### Context

**User story**: the user types a prompt or loads one of the project's commands in the launcher, picks a coding agent and a model, and presses Start; the tickets' and the queue's buttons start an agent the same way.

#### Business logic

The prompt is trimmed; an empty one is refused with "a non-empty prompt is required". The prompt, the user's picks (the coding agent, the model, and a device [12] when one is the target) and the project id go to the daemon's start (`daemon-runtime.ts`), which runs the project's start hook [4] or forwards to the device. The answer is the id of the agent the hook began, or the refusal in words ("this project has no start hook", "unknown project: …", the hook's own error). There is no busy refusal: a person's Start has no cap.

### Removing a retained checkout

#### Context

**User story**: an agent that failed or was stopped keeps its checkout so the user can look at what it was holding. Nothing removes such a checkout on a timer; the user removes it from the agent view, and expects never to lose work that exists nowhere else.

**Problem**: the daemon's removal rule (`MEMORY.md`) is that only what has been pushed to the remote may be removed, so every removal is recoverable from the remote. The dashboard's Remove lives in one implementation (`worktrees.ts`). An agent that ended waiting on its question [2] keeps its checkout too, and the user may remove it the same way.

#### Business logic

The project must be known here ("this project has no local path on this server"). The removal then runs under the agent's lock, so two removals of the same checkout, or a removal and a pull request being opened from it, run one after the other. The checks and the removal are the shared implementation's: an id unsafe for a path is refused before anything is touched ("invalid session id: …"); an agent with no checkout on disk is reported rather than claimed removed ("no worktree for session …"); an agent still going is refused ("that session is still going; stop it before removing its worktree"); a checkout holding uncommitted work is kept and the edit stays in it, nothing is committed on the agent's behalf ("session … has uncommitted work; its worktree was kept"); a branch the remote does not have is pushed first, and if it cannot be the checkout is kept ("… is not on the remote (…); its worktree was kept"); When the checks pass the checkout is removed, its committed work surviving on its branch and on the remote.

### Deleting an agent

#### Context

**User story**: the user removes an agent from the dashboard for good, records and all. This is the one action that destroys history, which is why the surface asking for it confirms first.

#### Business logic

Same project check and same lock as removing a checkout. The checks and what is left behind are the shared implementation's (`worktrees.ts`): an unsafe id is refused ("invalid session id: …"); an agent still going is refused ("that session is still going; stop it before deleting it"). The checkout, if one is on disk, is removed by force, and any uncommitted work goes with it: throwing the work away is what a delete is for. The agent's record then goes: when the runs provider [26] lists the agent, it is asked to remove it, and a refusal is the answer; a half-deleted agent whose checkout was already gone, an agent with no record and a project with no runs provider still finish cleanly. What stays is git's: the agent's branch (`agent-<id>`, or the name the agent gave it) and its commits, because deleting a branch that may carry merged work or an open pull request is not something a dashboard action does silently.

### Opening a checkout in the file manager or an editor

#### Context

**User story**: the user opens the project, or the checkout a particular agent is working in, in the OS file manager or in their editor, to look at what the agent is doing.

#### Business logic

Localhost-only by nature: the daemon spawns a local command against a registered path, never a path from the browser. When the project is unknown here the answer is "this project has no local path on this server". With an agent id the agent's own checkout is opened (the project's root when the agent has none); without one, the project's checkout. For the editor, the launcher used is the editor the preferences name, else `$FRAMEWORK_EDITOR`, else `code` (the fallback is `dashboard/open-in-app.ts`'s); a preferences read that fails counts as no preference. A launcher that is not installed comes back as a failure naming it ("… was not found on PATH"); any other failure to launch comes back as its message.

### Opening a pull request

#### Context

**User story**: an agent has ended; the user asks for a pull request for its work, and gets one without typing anything: the title and body come from what the agent already recorded.

#### Business logic

The agent must be known in a known project, by a path-safe id, else the answer is "unknown session". The decision of whether and how to open is `dashboard/agent-handoff.ts`'s: the agent's existing pull request is returned as the answer when it has one, unless the agent demonstrably kept committing after that pull request merged or closed; a branch that no longer exists is refused ("branch … no longer exists"); an agent that changed nothing is refused rather than given an empty pull request ("this session produced no commits to open a PR for"); otherwise the branch is published through the branches provider [30] (pushed when the remote lacks it, its pull request opened) ready for review, not as a draft, because a pull request a human asked for by name is asking for review. Its title is the agent's own when it recorded one, else its branch, else "Session <agent id>"; its body is what was asked and which agent did it. The call runs under the agent's lock, so the provider's push cannot race a removal of the same checkout. When a pull request was opened, its number and URL are recorded on the finished agent through the runs provider [26], when the project has one: the agent's process is gone by then, so no event can carry the fact, and every surface reads it from the same place rather than re-deriving it from branch names.

### Merging

#### Context

**User story**: an agent has ended with a pull request open, and the user lands it with one button.

#### Business logic

Same target rule ("unknown session"). An agent that is still running has no Merge: it publishes its own work, and the call answers "that session is still going". For an agent that has ended, its pull request is landed through the branches provider [30] (`dashboard/agent-handoff.ts`): refused when the agent has no pull request ("this session has no pull request to merge") or when it is no longer open ("this session's PR is already merged", or closed), since "already merged" is an answer, not an action; and the answer carries the pull request's number and URL.

### Controlling the bridge browser

#### Context

**User story**: in Settings the user shows the daemon's bridge browser [10] window for the one-time sign-in to claude.ai, hides it again, or restarts it.

#### Business logic

The action must be one of show, hide or restart; anything else is refused ("unknown action"). A browser that is not running ignores show and hide (the behavior is `bridge-browser.ts`'s). The call answers success once the action is handed over.

### Actions about a relayed agent go to the device

#### Context

**Problem**: an agent relayed [11] to a device [12] has no checkout on this machine; its inbox, its branch and its pull request all live on the device. The daemon holds the device's token, so it forwards the action there and the device runs it against its own checkout (the forwarding is `relay-agent.ts`'s, the device side `relay-dispatch.ts`'s).

#### Business logic

Stop, a pick, a message, opening a pull request and the merge are forwarded when the agent id names an agent this daemon relays (a stop is then that device's signal, a message that device's inbox or resume hook); for an ordinary local agent they run here unchanged. When the device cannot be reached, or refuses, a stop answers nothing, so it is lost silently; every other forwarded action answers "could not reach the device". Starting an agent, removing a checkout, deleting an agent, opening a checkout in an app, the claim action and the bridge actions are never forwarded: a Start for a device is forwarded by the daemon's start itself (`daemon-runtime.ts`), not from here, and destroying a device's history or checkouts is not something a relaying daemon may do.
