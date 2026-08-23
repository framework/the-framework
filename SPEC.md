The Framework: autonomous AI programming. Humans make the important decisions; coding agents work the user's registered repos unattended and hand the result off as pull requests. The product never makes model calls of its own — it drives a coding-agent CLI the user already pays for (Claude Code or Codex) as a black box, on the user's own subscription.

Three top-level pieces, one product:

- `packages/framework` — the product itself, published as the npm package `framework`: one CLI (`the-framework`) that runs a foreground daemon, the agent lifecycle it orchestrates, and the browser dashboard it serves — the product's only user interface.
- `packages/chrome-extension` — the Claude web bridge, a companion Chrome extension: when an agent's task was handed to a Claude Code cloud session on claude.ai, it carries the question that session is parked on into the local dashboard, and types the answer picked there back into the session.
- `packages/the-framework.ai` — the marketing website at https://the-framework.ai.

Every user-facing feature is enumerated in `FEATURES-SPEC.md`.

## User story

- A developer registers a repo, states what they want built or fixed, and gets a reviewable pull request without babysitting: the agent stops to ask only when a real decision is needed, and otherwise finishes on its own.
- A developer walks away entirely; the daemon keeps spending the account's leftover quota productively — draining the confirmed-task queue, triaging and planning tickets, fixing red CI on the pull requests it opened, merging them once checks pass — and stands down before unattended work could eat into the quota the human will want.
- The developer's own checkout is never touched: every agent works a throwaway checkout, and anything The Framework removes on its own initiative already exists on the git remote.

## Business logic — TL;DR

- **One daemon, one dashboard** - a single foreground framework process per machine serves the dashboard; the CLI itself has four options and no verbs, and every other decision lives in the dashboard.
- **The agent is the unit of work** - one task, in its own git worktree on its own branch, streaming everything it does as events; finished work is pushed and leaves as a pull request.
- **Black-box driving** - the framework prompts the wrapped coding-agent CLI, lets the CLI's own loop run a full turn, and learns everything from the turn's final message: the session name the agent invented, the questions it stops to ask, and the ready-for-merge signal.
- **Autonomy bounded by the account's own quota** - unattended work runs only while the account is under its pro-rated quota boundary; work a human asks for is never blocked, and a running agent is never interrupted over quota.
- **Framework data on its own branch** - everything The Framework itself writes (tickets, the agent queue, agent archives) lives on the `tf-data` branch, so the default branch stays 100% code.

## Business logic

### From a prompt to a pull request

#### User story

See `## User story`: a stated intent becomes a reviewable pull request without babysitting.

#### Business logic

The user starts an agent from the dashboard. The daemon gives it a fresh worktree and branch, frames the wrapped CLI with the built-in system prompt, and sends the task. The agent names its task (the session name; its branch is renamed to match), works turn by turn, and may park on a gate — a question with options the dashboard renders and the user answers (autopilot answers it automatically after a delay). When the agent signals ready for merge and the work settles, the handoff publishes it: by default, push the branch and open a pull request. How far the handoff goes is one ladder — keep it local, push, open a pull request, or merge — set per repo, per user, or per agent.

### Unattended operation

#### User story

See `## User story`: the daemon keeps working while nobody is around, within the account's own quota.

#### Business logic

On a shared clock the daemon runs its background jobs: Auto PM works the agent queue down and refills it by triaging tickets and planning the ones without plans; the CI watch merges the framework's pull requests once their checks pass and starts a fix agent when checks go red; sweeps reclaim finished agents' checkouts (only what is already on the remote) and keep bookkeeping healthy, and a routine that must not run twice is guarded by a routine lock on the data branch. Each unattended start checks the quota boundary first.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
