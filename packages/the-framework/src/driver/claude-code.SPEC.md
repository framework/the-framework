The driver for Claude Code: wraps the `claude` CLI as a black box on the user's own subscription, drives one full turn per prompt, and turns what the CLI prints into the event stream every surface of The Framework is a projection of.

## User story

The user runs an agent on their existing Claude Code subscription. They watch its text and its tool calls appear live in the dashboard, chat into it while it works, resume it later, and expect the whole thing to keep working without them ever supplying an API key.

## Business logic — TL;DR

- **One prompt is one CLI invocation** - each turn spawns the CLI fresh, non-interactively, and the turn ends when the CLI's own loop has finished; The Framework never sees or gates the individual tool calls in between.
- **Writes go through without asking** - the CLI is run in a mode where file edits need no confirmation, and a fully autonomous agent that also installs and runs things can be given the mode that confirms nothing at all.
- **The framing is added once per conversation** - the system prompt framing is appended when a turn starts a new conversation, and deliberately not when it continues an existing one, which already carries it.
- **Chat and resume continue the same conversation** - the agent's own session id is carried from turn to turn, so a chat message or a resumed agent picks up its history instead of starting cold.
- **A vanished conversation costs the history, never the message** - if the CLI no longer has the conversation being resumed, the same prompt is immediately re-sent as a fresh conversation, and the user is told the history is gone.
- **The session id is announced immediately** - it is published from the CLI's first line of output, so a turn that is stopped or dies mid-flight still leaves behind the handle needed to resume it.
- **Usage and quota both come for free** - the CLI's own end-of-turn accounting supplies what the turn spent, and its rate-limit notices supply where the account's subscription stands, with no extra call.
- **Extra tools merge, never replace** - tools The Framework wires in for a session (a real browser, for the browser preview) are added alongside the user's own configured tools.

## Business logic

### One prompt is one CLI invocation

#### User story

See `## User story`.

#### Business logic

Every prompt spawns the `claude` CLI non-interactively in its streaming mode, in the agent's own worktree, and lets its loop run to completion. The turn's outcome is the CLI's final message; if the CLI ends without one, the assistant text it produced along the way stands in for it. While the turn runs, the CLI's output is translated into the framework's event stream: the agent's prose becomes text events, and each tool the agent invokes becomes a labelled action event. Output that is not the CLI's structured stream — banners and other noise — is ignored rather than shown.

#### Rationale

The CLI is treated as a black box: The Framework prompts it and reads the outcome, and the CLI owns its own loop, its own tools, and its own subscription authentication. That is what lets a second coding-agent CLI slot in behind the same seam without changing anything above it.

### Writes go through without asking

#### User story

An agent works unattended; a permission prompt nobody answers is a hung agent.

#### Business logic

The CLI runs with file edits pre-approved by default. A project that wants a fully autonomous build — one that also installs dependencies and runs tests — can instead run with every permission check disabled, which is only appropriate in a sandbox without network access.

### The framing is added once per conversation, and chat and resume continue it

#### User story

The user types a message into a running agent, or resumes a finished one, and expects it to remember what it was doing.

#### Business logic

The agent's own session id from the last turn is kept. A turn asking to resume continues that exact conversation, which keeps the id stable so consecutive chat messages chain onto each other. An agent being resumed after it finished is seeded with its recorded session id, so its very first turn continues where it left off.

The system prompt framing is appended only when a turn starts a fresh conversation. A resumed conversation already contains its framing, so re-appending it would only duplicate it.

### A vanished conversation costs the history, never the message

#### User story

The user types a chat message into an agent whose conversation the CLI has since dropped — because it aged out of the CLI's retention, because history was cleared, or because the agent's record came from another machine.

#### Business logic

There is no way to ask the CLI in advance whether it still holds a conversation, so the resume is attempted, and when it fails specifically because the conversation is gone, the exact same prompt is immediately re-sent as a fresh conversation — which also restores the system prompt framing that a resumed turn omits. The user is told, in the agent's own event stream, that the conversation is no longer available and that work continues without its history.

The failed first attempt leaves no failure in the record: its error is held back until the retry is ruled in or out, so a turn that recovers never shows up as failed. The retry's repeat of the user's own message is suppressed too, so the message appears once in the transcript rather than twice.

A failure for any other reason, or the user stopping the agent, is reported as the failure it is and never retried.

### The session id is announced immediately

#### User story

An agent is stopped, or dies, halfway through a turn — and the user still wants to resume it later.

#### Business logic

The agent's session id is published as soon as the CLI's first line of output carries it, rather than waiting for the turn to finish. The session id is the handle for resuming the conversation, and a turn that never reaches its end would otherwise take that handle with it. It is published again only if it changes.

### Usage and quota both come for free

#### User story

The dashboard shows what each agent spent, and unattended work stands down as the quota boundary approaches.

#### Business logic

The CLI's end-of-turn line carries what the turn cost and how many tokens it used — input, output, and both kinds of cache tokens — and that becomes the turn's usage. When the line carries no price at all, no cost is reported rather than a cost of zero: zero means "this was free" to the spending limits, while nothing at all means "unknown", and one coding-agent CLI reports tokens without prices.

Separately, the CLI emits a rate-limit notice each turn saying where the account's subscription stands and when it resets. That notice is passed through as-is, costing no extra call and no polling. A notice missing any of the parts that would be acted on is dropped silently rather than reported as a bogus reset time.

Where the account's quota stands can also be asked for directly at any time, without a running agent, since the quota is account-wide rather than per-agent.

### Extra tools merge, never replace

#### User story

The user turns on the browser preview, which needs the agent to drive a real Chrome — without losing the tools they configured for their own project.

#### Business logic

Tools The Framework wires in for an agent are written to a throwaway config that is added to the CLI's own configuration rather than substituted for it, so the user's configured tools stay available. The config is written once per agent, reused for all its turns, and deleted when the agent is disposed of.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
