Answers which models each coding agent [1] a person can pick offers, by asking the coding agents themselves through their drivers [2], and keeps each answer for the daemon's [3] life.

## Context

**User story**: the user opens the agent and model menu and sees exactly the models their own Claude Code and Codex offer for their login, by the names those tools show ("Opus 5.5", "GPT-5.6-Terra"), instead of a list written into The Framework that goes stale when a coding agent adds or retires a model.

**Problem**: asking a coding agent starts its CLI, which takes about a second; a menu opened many times must not start a CLI each time.

## Glossary

[1] coding agent: the CLI doing the actual work: Claude Code or Codex.
[2] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[3] daemon: The Framework's long-running local process that serves the dashboard and starts agents.

## Business logic — TL;DR

- **Asked once, then kept** - the first read asks every coding agent [1] at once, through its driver [2] (Claude Code and Codex on this machine, as the person's own login); two reads at the same moment share one question; every later read answers from what each said, for the daemon's [3] whole life. A new list needs a daemon restart, as a new CLI version or a new login is the only thing that changes it.
- **A coding agent that could not say** - its answer is an empty list with its reason in words (such as the CLI missing or its answer unreadable); it is asked again at the next read, so a coding agent installed or logged in since is found. A driver with no way to list its models answers "this agent cannot list its models".
