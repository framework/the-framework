The driver [1] seam of The Framework: one contract under which a coding agent [2] is a black box, started in a directory, prompted for one turn [3] at a time, streamed as progress events [4] and resumed later, and four implementations of it: Claude Code on this machine, Codex on this machine, Claude Code on a GitHub Actions runner, and a scripted fake. The product's agent [5] lifecycle in `packages/framework` speaks only this contract, so a fifth implementation, Claude Code in a cloud session [6] (`packages/framework/src/driver/cloud.ts`), slots in behind it without touching anything above. Everything here runs on the user's own login to the coding agent: The Framework never holds a model key and never calls a model itself.

## Context

**User story**: the user picks `claude` or `codex` as the driver [1] for an agent [5], and a location [7] for it; the agent view then shows what the coding agent [2] says, which tools it uses, what it spent, and, for Claude Code, where the account's quota [8] stands. Stopping the agent, or closing The Framework with Ctrl-C, leaves no coding agent process running on the machine.

**Business logic story**: the seam is deliberately the prompt, the final message and the code left in the directory, never the coding agent's individual tool calls. Each coding agent keeps its own subscription login and its own loop; The Framework prompts it, reads its output for text, tool names, a session id, usage [9] and rate limit [10] readings, and decides a turn's [3] success from the process's exit code or the run's conclusion, never from streamed text.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[4] progress event: what a driver reports while a turn runs, for a caller to show and never to decide on: the prompt sent, the session id, streamed text, a tool used, the final result, a rate limit reading, an error, a notice.
[5] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[6] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[7] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[8] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[9] usage: what one turn spent, as the coding agent reports it: token counts, and a notional price in US dollars when the coding agent prices its turns.
[10] rate limit: the coding agent's per-turn reading of whether the account may still spend against one quota window, and when that window resets.
[11] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[12] framing: the standing instructions a caller gives a driver session, plus any extra instructions for one turn; the driver delivers them as the coding agent's system prompt, or ahead of the prompt when the coding agent has no system prompt flag.
[13] stop request: the caller's signal that a driver session, or one turn of it, must end now; the product raises one when the user stops the agent.
[14] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[15] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[16] correlation id: the id the `github-actions` driver makes up for one turn and hands the workflow, which echoes it into the run's display name and the artifact's name; it is the only way the driver finds its own run.

## Business logic — TL;DR

- **The contract** (`types.ts`) - what every driver [1] promises, how a driver session [11] is started, what one turn [3] returns, the eight kinds of progress event [4], the three readings of spend (usage [9], rate limit [10], quota [8]), and which reasons for an empty quota reading are transient.
- **What every driver session shares** (`session-support.ts`) - reporting progress events without letting a listener break the coding agent [2], folding the driver session's stop request [13] and framing [12] with a turn's own, and reading a file out of the directory.
- **One turn as one process** (`cli-session.ts`, `cli-session.test.ts`) - a local coding agent is spawned as its own process-group leader in the driver session's directory, fed the prompt over standard input, streamed line by line through the driver's parser, and judged on its exit code; a stop request terminates the whole tree, with a forced kill 5 seconds later.
- **Reaping every process tree** (`child-registry.ts`) - every live process group is registered so a stop reaches the whole tree with one signal and a hard exit of The Framework still kills every tree on the way out.
- **Claude Code on this machine** (`claude-code.ts`, `claude-code.test.ts`) - one non-interactive `claude` invocation per turn with framing as the system prompt, text, tool names, session id, usage and rate limit readings read off its streamed JSON, the driver session continued and revived through Claude Code's own resume, and a vanished conversation retried once as a fresh turn.
- **The account's quota** (`claude-code-quota.ts`, `claude-code-quota.test.ts`) - Claude Code's own usage readout parsed into windows with a percentage each, and every empty reading named by a reason that says whether the attempt failed or the login has no quota.
- **Codex on this machine** (`codex.ts`, `codex.test.ts`) - one non-interactive `codex` invocation per turn, sandboxed to the directory, framing ahead of the prompt, the last message as the answer, tokens without a price, never resumed and with no quota.
- **Claude Code on a GitHub Actions runner** (`actions.ts`, `actions.test.ts`) - each turn dispatches the agent workflow with the prompt as an input, finds its run by a correlation id [16], waits up to 1 hour, reads the transcript back from the run's artifact and replays it in a burst; continuity across turns is one branch the driver names and every run pushes to.
- **Reading a run's artifact** (`actions-zip.ts`, `actions-zip.test.ts`) - the zip archive GitHub hands back is read entry by entry and refused outright when it is not an archive, never read short.
- **The scripted fake** (`fake.ts`, `fake.test.ts`) - scripted or responder-driven turns with the same progress events as a real driver, no process and no model, for tests and offline demos.
- **The entry point** (`index.ts`) - everything the product may import: the contract, the four drivers with their parsers, the quota reader and the pieces an outside driver builds on; the zip reader stays internal.
- **A turn on this machine, end to end** - how a local driver's command line and parser, the shared process core, the isolated reporter and the process registry together carry one turn from prompt to exit code, and what a stop does to the process tree.
- **Where the implementations differ** - how each implementation starts its coding agent, delivers framing, resumes a conversation, reports spend and quota, reads code back, and whose login it spends.

## Business logic

### A turn on this machine, end to end

#### Context

**User story**: the user starts an agent [5] with location [7] `local` and follows it in the agent view; the user stops it, or closes The Framework, and nothing of the coding agent [2] survives.

#### Business logic

The Claude Code and Codex drivers [1] each supply only two things for a turn [3]: the command line to run and the parser that understands their coding agent's [2] output. Everything about the process is shared (`cli-session.ts`): the coding agent is spawned in the driver session's [11] directory, the agent's [5] checkout [14], as the leader of its own process group; the prompt is fed over standard input; a `start` progress event [4] announces the turn; every output line goes through the driver's parser and its progress events are forwarded through the isolated reporter (`session-support.ts`) as they come; and the exit code decides the turn, so a crash after streamed text is a failed turn. While the process lives its group is registered (`child-registry.ts`), so a stop request [13] terminates the whole tree at once, with a forced kill 5 seconds later, and a hard exit of The Framework's process kills every registered tree on the way out. A turn has no time limit of its own on this machine; only the GitHub Actions driver gives up waiting, after 1 hour.

### Where the implementations differ

#### Context

**Business logic story**: the contract is one, the coding agents [2] are not. The differences below are each coding agent's own business; the caller sees the same driver session [11], turns [3] and progress events [4] whichever implementation carries the agent [5].

#### Business logic

- **How the coding agent is started**: Claude Code and Codex are one process per turn [3] on this machine; the GitHub Actions implementation dispatches one workflow run per turn on a fresh runner; the fake starts nothing.
- **How framing reaches the coding agent**: Claude Code takes the framing [12] as an addition to its system prompt; Codex and the GitHub Actions workflow take it ahead of the prompt as its own block; the fake ignores it.
- **Resuming a conversation**: Claude Code resumes its own conversation by session id on this machine, and retries once fresh when that conversation is gone; the GitHub Actions implementation hands the session id to the workflow to resume; Codex and the fake never resume, so a live chat [15] message to a Codex agent starts fresh.
- **What is spent**: Claude Code reports tokens and a price; Codex reports tokens and no price, never zero; only Claude Code reports rate limit [10] readings, and only the `claude-code` implementation reads the account's quota [8]; Codex, the GitHub Actions implementation and the fake offer no quota reading rather than a made-up number.
- **Where the code is read**: the local implementations and the fake read a file from the directory or the seeded files; the GitHub Actions implementation reads it from the branch the run pushed, because the runner is gone.
- **Whose login is spent**: Claude Code's and Codex's own logins on this machine, and the OAuth token the repository holds as a secret on a runner. In every case the caller never holds a model key.
