The driver seam: the single contract every coding-agent CLI is wrapped behind, and the vocabulary the caller speaks about agents, what they spend, and where the account's subscription stands.

## User story

The user picks which coding agent does the work — Claude Code or Codex — and where it runs. Everything else about the caller's product behaves identically either way: the same UI, the same live event stream, the same gates. Adding another coding agent later must not change any of that.

## Glossary

- **caller** - the product that embeds the package and drives agents through it.
- **turn** - one prompt handed to the wrapped CLI and the whole loop it runs in response, ending with the agent's final message. A turn is the unit the caller gates on.
- **quota window** - one named allowance the account's subscription is measured in: the current session, the current week across all models, or the current week for one model.

## Business logic — TL;DR

- **The CLI is a black box** - the caller prompts it, lets its own loop run to completion, and then reads the code it produced. It never gates on which tool the agent reached for.
- **Every pass is a fresh prompt** - review, security, QA, UX: each is its own prompt with its own fresh context, and a role is framing added to the prompt rather than a separate kind of agent.
- **Capabilities are optional, never faked** - reading the account's quota, reading a file from the agent's workspace, and continuing a previous conversation are each offered only by drivers that can genuinely do them; a driver that cannot simply does not, and the product copes.
- **Events are for looking, not for deciding** - everything the agent streams reaches the caller's UI for visibility, and no control flow ever branches on it.
- **Spend, traffic light, and proportion are three different things** - what an agent spent, whether the account may still spend, and how much of the allowance is gone are kept strictly apart and never substituted for one another.
- **"We could not ask" is never "nothing is used"** - a quota reading is either a real reading or an explicit absence with a reason, so an unanswered question can never be read as an empty allowance.
- **A failed reading says whether it is worth asking again** - failures that describe one attempt are distinguished from failures that describe the account or the installation.

## Business logic

### The CLI is a black box

#### User story

See `## User story`.

#### Business logic

A driver hands the wrapped CLI a prompt, lets the CLI's own loop run all the way to completion, and then judges the result — does it build, does it serve, does a review pass. The seam is deliberately the code and the outcome, never the agent's individual tool calls. That is what lets the wrapped CLI keep its own subscription sign-in and its own internal loop untouched, and what lets a second coding agent slot in behind the same contract without anything above it changing.

The contract is deliberately tiny: start an agent bound to a checkout, prompt it, read the code it produced, tear it down.

#### Rationale

Two identities are kept apart. The **driver** is the user's choice — Claude Code or Codex. Each driver has a separate implementation for each place it can run, since running on a GitHub Actions runner or in a cloud session is a different mechanism from running on this device, and the run target is a fact about *where*, not about *which agent*. The contract fixes the set of implementation ids (`claude-code`, `codex`, `claude-web`, `github-actions`, `fake`), because an agent's record names the implementation that ran it and every reader of that record must agree on the vocabulary; mapping an id back to the user's choice is the caller's business, not the package's.

### Every pass is a fresh prompt

#### User story

An agent plans, then builds, then reviews its own work for quality, security, and user experience — and each of those passes should think about the task with a clear head rather than dragging the previous pass's context along.

#### Business logic

Each pass is its own prompt, and a prompt is the unit of fresh context. Everything runs through the driver — there is no second execution path — and a role is delivered as framing prepended to the prompt rather than as a separate kind of agent. Framing exists at two levels: framing that applies to every prompt of an agent, and framing added for one prompt only.

The one deliberate exception is continuing a conversation: a prompt may ask to pick up the agent's previous turn instead of starting fresh, which is how a live chat message lands in the ongoing conversation with its full history, and how a finished agent is revived from the caller's UI with everything it already knew.

### Capabilities are optional, never faked

#### User story

The caller's UI shows a quota bar for a Claude Code agent and none for a Codex one, because Codex has no quota to report. A missing capability is honest; a made-up number is not.

#### Business logic

Three capabilities are optional. Reading where the account's subscription quota stands belongs to the driver rather than to any one agent, because it is an account-wide fact — and a coding agent that cannot report it offers nothing rather than a guess, which is exactly what makes a caller's spending limits inapplicable rather than wrongly applied. Reading a file out of the agent's workspace is offered only when that workspace is on this machine. Continuing a previous conversation is best-effort: a driver that cannot resume runs a fresh prompt instead, which is the ordinary case and never an error.

### Events are for looking, not for deciding

#### User story

The user watches an agent's prose and tool calls appear live in the caller's UI while it works.

#### Business logic

An agent publishes, as it works: the prompt starting; its session id; each chunk of prose; each tool it reached for, by name only and never with its arguments; where the account's quota stands; the turn's final outcome; a failure; and a notice — something the driver worked around that the user should know about, such as a conversation whose history was lost.

None of this is ever branched on. It exists so every surface of the caller's — a UI, a terminal — can show what is happening. A surface that fails while handling an event must not take the agent down with it.

The session id is published at the start of the turn as well as with the outcome, because a turn that never reaches its end — the user pressing Stop, a crash, a kill — would otherwise take the handle for resuming that conversation with it.

The turn's outcome can additionally carry two things that only some drivers have: the real address of the agent's session, when it lives somewhere with a page of its own, so the agent's record links there rather than to a generic entry point; and the hand-off anchor, for an agent whose work happens on a branch of the wrapped agent's own naming that this machine can only recognize afterwards by tracing ancestry.

### Spend, traffic light, and proportion are three different things

#### User story

The user wants to know what an agent cost them, whether unattended work should stand down, and how much of the week is left — three different questions.

#### Business logic

**Usage** is what one turn spent: tokens broken into new input, output, cache reads, and cache writes, plus a price when the coding agent prices its own turns. When it does not, no price is reported at all — never zero, which a caller's spending limit would read as "this was free" rather than "unknown". Tokens are reported by every coding agent; a price is reported by only some, which is why an agent that cannot price a turn still reports the tokens it does know.

The price is notional in any case: under a subscription the user pays a flat fee, and the figure is what the turn would have cost at metered rates. What a subscription actually consumes is quota.

**The traffic light** is what the wrapped agent volunteers each turn: whether the account may still spend against a given quota window, and the exact moment that window resets. Both the status and the window's name are passed through as given rather than restricted to the values seen so far — a value nobody has seen before is precisely the signal worth capturing, so it must surface rather than be dropped.

**The quota reading** is the missing middle: for each quota window, how much of it is gone, as a proportion. It is the only one of the three that can fill a progress bar. Its reset time is carried as the words the agent used rather than as an instant, because the agent prints no year and converting it would be guesswork; the traffic light carries the exact instant for the window it covers.

#### Rationale

There are deliberately no daily allowances. The subscription is measured in a several-hour session window and in weeks, with individual models getting weeks of their own; nothing is measured per day, and an earlier plan for a daily limit was written against an allowance that does not exist.

### "We could not ask" is never "nothing is used", and a failure says whether to ask again

#### User story

Unattended work stands down as the quota boundary approaches. A reading that silently came back empty would tell the caller it has the whole week to spend.

#### Business logic

A quota reading is either a real reading with its windows, or an explicit absence carrying the reason — never an empty list of windows, which a caller could mistake for an unused allowance.

The reasons split into two kinds. Some describe *this attempt*: the agent's own lookup being refused upstream, the agent not answering in time, and an answer in a shape the package did not recognize — the last of which covers an update notice printed ahead of the answer, or an empty answer while the CLI replaces itself underneath a long-running process, both of which are gone by the next reading. A previous reading is still worth showing through those, and asking again may work.

The remaining reasons describe the account or the installation — no subscription quota exists, or the CLI is not installed — and are statements about the setup rather than about one attempt. A previously retained reading must not outlive them.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
