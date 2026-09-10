Reads where the account's quota [1] stands by asking Claude Code for its own usage readout and parsing the prose it prints: one window per line, each with its label, its kind, the percentage used and, when printed, when it resets. Claude Code answers locally with its own credentials, so the reading costs no model turn and The Framework never handles the user's token. A reading that yields no window is reported as unavailable with a reason that says whether this attempt failed or the setup has no quota to report, never as an empty list that would read as nothing used.

## Context

**User story**: the dashboard shows the account's quota [1] as bars, one per window, and unattended work stands down past the quota boundary [2]; a wrong reading of "nothing used" would let unattended agents [3] run the account dry.

**Business logic story**: Claude Code prints its usage as prose for a person, not as data, so this is a text parse and a reworded readout is a real failure mode. Every empty reading therefore carries a reason, and the daemon's rules for keeping or dropping an earlier reading rest on that reason (`packages/framework/src/quota-poller.ts`). The Claude Code driver [4] reads the quota through this reader (`claude-code.ts`).

## Glossary

[1] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[2] quota boundary: the share of the quota week that may be spent by now, rising with the clock; unattended work stands down past it, work a human asked for never does.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[5] coding agent: the CLI doing the actual work: Claude Code or Codex.
[6] stop request: the caller's signal that a driver session, or one turn of it, must end now; the product raises one when the user stops the agent.

## Business logic — TL;DR

- **Asking Claude Code for its readout** - the `claude` command runs its own usage command in print mode with JSON output, never in the mode that pins it to API-key login; the answer costs nothing and the caller never sees a credential.
- **Unwrapping the answer** - Claude Code's JSON envelope is opened for the readout text; an envelope flagged as an error is a failed fetch, and anything not shaped like the envelope is unrecognized.
- **Reading the windows** - each line of the form "<label>: <n>% used · resets <when>" is one window, its kind decided by its label; lines that merely resemble a window are ignored.
- **An empty reading names its reason** - no window with Claude Code's subscription header present means the readout was not recognized; no window without the header means the login has no subscription quota [1] to report; an account burning overage still reads.
- **Failures of the attempt** - a `claude` command that cannot be started is a missing coding agent [5]; a non-zero exit is a failed fetch; no answer within 20 seconds, or a stop request [6], is a timeout and ends the process.
- **Which reasons are transient** - a failed fetch, a timeout and an unrecognized readout describe one attempt; a missing coding agent and a login without a subscription describe the setup.

## Business logic

### Asking Claude Code for its readout

#### Context

See `## Context`.

#### Business logic

The reading runs the `claude` command, found on `PATH` unless another command is configured, in print mode with JSON output and the prompt `/usage`, Claude Code's own usage command (`claude -p /usage --output-format json`). Claude Code answers it locally rather than by prompting a model, so the reading spends zero turns and zero tokens; it reaches Anthropic itself with its own login, so the caller never reads or handles the user's token. The command is never run in Claude Code's bare mode, which pins it to API-key login and would hide the subscription quota [1] this reads. The working directory is incidental, since the reading is account-wide; the process runs with the environment of The Framework's own process unless another is configured.

### Unwrapping the answer

#### Context

See `## Context`.

#### Business logic

Claude Code's answer is a JSON envelope around the readout text. An envelope that Claude Code flags as an error, for instance because its own usage fetch was refused upstream, is a failed fetch (`fetch-failed`). Output that is not JSON, JSON that is not an object, or an object without a readout text is unrecognized (`unrecognized`). Otherwise the readout text is read for windows.

### Reading the windows

#### Context

**Problem**: the readout also prints a breakdown of what contributed to the usage, with lines shaped closely enough to a window to fool a loose reading, such as "Top skills: /dataviz 2%, /claude-api 1%" and "70% of your usage was at >150k context". Reading one of those as a window would show a bar that measures nothing.

#### Business logic

Each line of the readout is a window only when the whole line has the form "<label>: <n>% used", optionally followed by " · <reset phrase>"; the percentage may be fractional. The window keeps its label as printed, its percentage, and the reset phrase with the leading word "resets" stripped, as prose (for instance "Jul 18 at 7am (Asia/Jerusalem)" or "in 2h 53m"); a window printed without a reset phrase carries none. The label decides the window's kind, case-insensitively: "Current session" is `session`, "Current week (all models)" is `week`, "Current week (<anything else>)" is `week-model`, and any other label is `unknown`. Every other line is ignored. With at least one window, the reading is available and lists the windows in the readout's order.

### An empty reading names its reason

#### Context

**Problem**: a readout with no readable window can mean two different things, and only one of them is a statement about the account. Reporting it as zero use would read as "nothing used" and let a spending gate run the account dry; confusing the two reasons would drop a good earlier reading, or keep a stale one, for the wrong account.

#### Business logic

When no line reads as a window, the readout is checked for the tail Claude Code prints in both of its subscription headers, "to power your Claude Code usage", which appears whether the account is "using your subscription" or, mid-overage, "using your overages", and in neither non-subscription case. With the header, the account does have a quota [1] and the readout was reworded past what the reader recognizes: the reading is unavailable as `unrecognized`. Without it, the login has no subscription quota to report, as with an API key: the reading is unavailable as `no-subscription`. An empty readout is therefore unavailable, never zero use, and an account burning overage still reads its windows normally.

### Failures of the attempt

#### Context

**User story**: the user has not installed Claude Code, has it hang, or stops the daemon while it is reading; the dashboard shows the quota [1] as unavailable with a reason rather than waiting forever.

#### Business logic

A `claude` command that cannot be started at all, because it is not installed or not on `PATH`, is reported as `agent-not-found`. A command that exits with a non-zero code is a failed fetch (`fetch-failed`). A command that has not answered within 20 seconds is terminated and reported as `timeout`; a stop request [6] raised while the reading runs terminates it and is reported the same way, and one already raised before the reading starts is reported as `timeout` without starting anything. The reading settles exactly once, whichever of these happens first.

### Which reasons are transient

#### Context

**Business logic story**: the daemon keeps a recent quota [1] reading on hand and re-reads it on a slow clock; whether an earlier reading may stand in for a failed one depends on what the failure says (`packages/framework/src/quota-poller.ts`).

#### Business logic

Of the reasons this reader yields, `fetch-failed`, `timeout` and `unrecognized` describe one attempt: the account may well have a quota [1], and asking again may work. `agent-not-found` and `no-subscription` describe the setup: the install or the login itself, which no retry changes. The split is fixed in `types.ts`.
