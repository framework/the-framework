The driver [1] seam of The Framework: one contract under which a coding agent [2] is a black box, started in a directory, prompted for one turn [3] at a time, streamed as progress events [4] and resumed later, the pieces every implementation of it shares, and a scripted fake. The real implementations are adapters in their own packages, built on these pieces: `@agent-driver/claude` (`packages/agent-driver-claude`: Claude Code on this machine and on a GitHub Actions runner, and the account's quota) and `@agent-driver/codex` (`packages/agent-driver-codex`: Codex on this machine). Its callers speak this contract and pick an adapter by name: the runner (`packages/agent-runner`) runs every agent [5] through it, the scheduler (`packages/agent-scheduler`) and the product (`packages/framework`) read the account's quota from the Claude adapter, and the product writes to a run's inbox through this package, so a further adapter slots in without touching anything above. Everything here runs on the user's own login to the coding agent: The Framework never holds a model key and never calls a model itself.

## Context

**User story**: the user picks `claude` or `codex` as the driver [1] for an agent [5]; the agent view then shows what the coding agent [2] says, which tools it uses, what it spent, and, for Claude Code, where the account's quota [8] stands. Stopping the agent, or closing The Framework with Ctrl-C, leaves no coding agent process running on the machine.

**Business logic story**: the seam is deliberately the prompt, the final message and the code left in the directory, never the coding agent's individual tool calls. Each coding agent keeps its own subscription login and its own loop; The Framework prompts it, reads its output for text, tool names, a session id, usage [9] and rate limit [10] readings, and decides a turn's [3] success from the process's exit code or the run's conclusion, never from streamed text.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[4] progress event: what a driver reports while a turn runs, for a caller to show and never to decide on: the prompt sent, the session id, streamed text, a tool used, the final result, a rate limit reading, an error, a notice, a question.
[5] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[8] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[9] usage: what one turn spent, as the coding agent reports it: token counts, and a notional price in US dollars when the coding agent prices its turns.
[10] rate limit: the coding agent's per-turn reading of whether the account may still spend against one quota window, and when that window resets.
[11] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[12] framing: the standing instructions a caller gives a driver session, plus any extra instructions for one turn; the driver delivers them as the coding agent's system prompt, or ahead of the prompt when the coding agent has no system prompt flag.
[13] stop request: the caller's signal that a driver session, or one turn of it, must end now; the product raises one when the user stops the agent.
[14] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[15] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[17] question: the fenced `await-choices` block an agent ends a turn with when it will not decide alone: a title, options, a recommended one.
[18] inbox: a file of lines from outside the agent, messages and answers, sent into the session when a turn ends.
[19] log: the card and the diary of one driver session, two files in a run record's shape at a directory the caller gives.
[20] personal setup: the three parts of the person's own setup a coding agent loads when started by hand, by the names every adapter takes: `memory` (what the coding agent remembers across sessions on its own), `connectors` (the apps and accounts linked to the person's login), `skills` (the person's own instructions, skills and settings files).

## Business logic — TL;DR

- **The contract** (`types.ts`) - what every driver [1] promises, the three parts of the personal setup [20] every adapter takes (each on or off, a part an adapter cannot turn off said in its readiness check, all on when none is given), how a driver session [11] is started (with a log [19] when asked), what one turn [3] returns (draining an inbox [18] first when named), the nine kinds of progress event [4], the three readings of spend (usage [9], rate limit [10], quota [8]), and which reasons for an empty quota reading are transient.
- **The question** (`question.ts`, `question.test.ts`) - the one parser of the block an agent ends a turn with when it asks [17], tolerant, and the continuation prompt an answer resumes the agent with.
- **The inbox and the end of a turn** (`inbox.ts`, `inbox.test.ts`) - lines appended from outside are taken once, in order; at every turn's end the question is reported and the waiting lines become further turns of the same session, until none waits; then the prompt returns.
- **The log** (`session-log.ts`) - the card and the diary in a run record's shape, written as events arrive, each diary line with the time it was written, patched, ended and reopened by the caller; the Claude Code and Codex implementations hand the diary's path to the coding agent as `AGENT_DIARY`, so a command it runs can append its own lines.
- **What every driver session shares** (`session-support.ts`) - reporting progress events without letting a listener break the coding agent [2], folding the driver session's stop request [13] and framing [12] with a turn's own, and reading a file out of the directory.
- **One turn as one process** (`cli-session.ts`, `cli-session.test.ts`) - a local coding agent is spawned as its own process-group leader in the driver session's directory, fed the prompt over standard input, streamed line by line through the driver's parser, and judged on its exit code; a stop request terminates the whole tree, with a forced kill 5 seconds later.
- **Reaping every process tree** (`child-registry.ts`) - every live process group is registered so a stop reaches the whole tree with one signal and a hard exit of The Framework still kills every tree on the way out.
- **Can a session start here** (`ready.ts`, `ready.test.ts`) - before a run spends a checkout [14], the coding agent's [2] CLI is asked whether it is installed and logged in, with the questions and answers an adapter hands in: a missing or logged-out CLI is a problem naming its fix, an answer that cannot be read passes, and running as root is a warning; an adapter adds its own warnings, such as a part of the personal setup [20] it cannot turn off.
- **The scripted fake** (`fake.ts`, `fake.test.ts`) - scripted or responder-driven turns with the same progress events as a real driver, no process and no model, for tests and offline demos.
- **The entry point** (`index.ts`) - everything a caller or an adapter may import: the contract with the personal setup's part names, the fake, the question, the inbox and the end of a turn, the log, the readiness check with its real probe, and the pieces an adapter builds on (the progress-event reporter, the framing and stop-request folding, reading a file back, the process core).
- **A turn on this machine, end to end** - how a local adapter's command line and parser, the shared process core, the isolated reporter and the process registry together carry one turn from prompt to exit code, and what a stop does to the process tree.
- **Where the implementations differ** - how each implementation starts its coding agent, delivers framing, resumes a conversation, reports spend and quota, reads code back, turns off the personal setup [20], and whose login it spends; the log, the question and the inbox they all share.

## Business logic

### A turn on this machine, end to end

#### Context

**User story**: the user starts an agent [5] on this machine and follows it in the agent view; the user stops it, or closes The Framework, and nothing of the coding agent [2] survives.

#### Business logic

The Claude Code and Codex adapters each supply only two things for a turn [3]: the command line to run and the parser that understands their coding agent's [2] output. Everything about the process is shared (`cli-session.ts`, here): the coding agent is spawned in the driver session's [11] directory, the agent's [5] checkout [14], as the leader of its own process group; the prompt is fed over standard input; a `start` progress event [4] announces the turn; every output line goes through the driver's parser and its progress events are forwarded through the isolated reporter (`session-support.ts`) as they come; and the exit code decides the turn, so a crash after streamed text is a failed turn. While the process lives its group is registered (`child-registry.ts`), so a stop request [13] terminates the whole tree at once, with a forced kill 5 seconds later, and a hard exit of The Framework's process kills every registered tree on the way out. A turn has no time limit of its own on this machine; only the GitHub Actions driver gives up waiting, after 1 hour.

### Where the implementations differ

#### Context

**Business logic story**: the contract is one, the coding agents [2] are not. The differences below are each coding agent's own business; the caller sees the same driver session [11], turns [3] and progress events [4] whichever implementation carries the agent [5].

#### Business logic

- **How the coding agent is started**: Claude Code and Codex are one process per turn [3] on this machine; the GitHub Actions implementation dispatches one workflow run per turn on a fresh runner; the fake starts nothing.
- **How framing reaches the coding agent**: Claude Code takes the framing [12] as an addition to its system prompt; Codex and the GitHub Actions workflow take it ahead of the prompt as its own block; the fake ignores it.
- **Resuming a conversation**: Claude Code resumes its own conversation by session id on this machine, and retries once fresh when that conversation is gone; the GitHub Actions implementation hands the session id to the workflow to resume; Codex resumes its own conversation by thread id on this machine, and a resume it refuses fails the turn; the fake never resumes.
- **What is spent**: Claude Code reports tokens and a price; Codex reports tokens and no price, never zero; only Claude Code reports rate limit [10] readings, and only the `claude-code` implementation reads the account's quota [8]; Codex, the GitHub Actions implementation and the fake offer no quota reading rather than a made-up number.
- **Where the code is read**: the local implementations and the fake read a file from the directory or the seeded files; the GitHub Actions implementation reads it from the branch the run pushed, because the runner is gone.
- **What they share**: every implementation attaches the log [19] when the caller asked for one, so each event is recorded before the caller sees it, and ends every turn the same way: the question [17] reported, the inbox [18] drained.
- **The personal setup** [20]: Claude Code turns each part off with a switch of its own (an environment variable for `memory` and `connectors`, leaving out the user settings for `skills`); Codex turns `memory` and `connectors` off with its feature switches and `skills` off by running from a Codex home of its own that holds only a link to the person's login, and cannot keep out skills in `~/.agents/skills`, which its readiness check warns about; the GitHub Actions runner holds no personal setup; the fake has none.
- **Whose login is spent**: Claude Code's and Codex's own logins on this machine, and the OAuth token the repository holds as a secret on a runner. In every case the caller never holds a model key.
