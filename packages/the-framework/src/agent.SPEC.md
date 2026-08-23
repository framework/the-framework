Runs one agent from start to finish: frame the coding agent, send it the opening prompt, honour every gate it parks on, work the agent queue, stay open for the user's own messages, and publish one event stream that every surface reads.

## User story

The user gives The Framework a task. From there the agent runs unattended: it works, it asks when it needs a decision, it works down the confirmed backlog, it takes follow-up messages, and it ends — with the whole story visible in the dashboard as it happens.

## Business logic — TL;DR

- **An agent is one prompt, honouring gates** - the two kinds of agent differ only in which prompt opens them and whether the agent queue is worked afterwards.
- **The framing is composed once, up front** - the built-in system prompt plus the user's own `SYSTEM.md`, unless vanilla drops the built-in one or transparent empties the framing entirely.
- **A build is framed for the workspace it lands in** - an empty workspace is built from scratch, an existing codebase is extended rather than rebuilt.
- **Every turn's question is a gate** - the agent parks, the user picks, the agent is re-prompted with the answer; with nobody watching, the recommended option is auto-accepted.
- **An answer that says stop ends the agent** - it ends exactly the way the Stop button does, on every path, and never publishes the work the user just declined.
- **A build that produced nothing is pushed once** - if a build leaves the workspace empty, the agent is re-prompted once with a hard directive to create the app from scratch.
- **The agent queue is worked after the opening exchange settles** - a build then consumes the confirmed backlog one gated entry per turn until it is empty.
- **Live chat comes last** - a build takes the user's own messages once its backlog is worked; a one-prompt agent takes them straight after its opening exchange.
- **A hands-off agent is its opening prompt and nothing else** - the work leaves this machine, so every later phase is dropped, the agent is told to land its own work, and it says so before ending.
- **A hands-off agent decides alone only when nothing can answer it** - with the Claude web bridge on, its framing leaves the gates in place, because the bridge carries its question to the dashboard and types the answer back.
- **The agent always ends with a verdict** - success, stopped, or failed with the reason, and the coding agent's session is always closed.

## Glossary

- **await limit** - the cap on how many times in a row an agent may park on a gate within one exchange.

## Business logic

### An agent is one prompt, honouring gates

#### User story

Whether the user typed a raw prompt or asked for something to be built, the dashboard, the archive and the control channel show the same shape of story.

#### Business logic

There are two kinds of agent: a build, which composes an opening prompt around the user's intent and afterwards works the agent queue, and a one-prompt agent, which sends the user's text as-is and stops there. Everything else is identical: the same framing, the same gates, the same event stream, the same ending. An agent defaults to being a build.

Every agent emits one event stream — its opening session announcement, what it was asked for, its system prompt, each driver turn, each gate, its usage, and its ending — so the dashboard, the archive and the control channel all read one shape regardless of what opened the agent.

#### Rationale

There used to be two separate implementations, one driving a build through a scaffolding spine and one running a prompt verbatim, and they drifted apart. Once the review loop and that spine were removed, the build path *was* "one prompt, honouring gates" — which is what the prompt path already was. What is left of the difference is two options, not two implementations.

### The framing is composed once, up front

#### User story

A repo wants its own house rules to apply to every agent, on top of the framework's own instructions — and, occasionally, a user wants the wrapped coding agent with nothing added at all.

#### Business logic

The agent's framing is composed once, before the first prompt: The Framework's built-in system prompt, then the user's own `SYSTEM.md` on top, so a repo adds instructions rather than replacing them. Vanilla drops the built-in prompt while keeping the rest. Transparent empties the framing entirely — the raw wrapped coding agent — and overrides vanilla. When the agent has a real browser available, the framing says so. In-context directories are added to the framing as a single context line.

Both what the agent was asked for and the composed framing are published as events, so the dashboard has the agent's title without parsing a prompt, and the framing is visible in full. Every per-turn prompt is visible too, as part of that turn's own events.

### A build is framed for the workspace it lands in

#### User story

A user runs a build against an empty directory and gets a new app; a user runs one against their existing codebase and gets that codebase extended, not replaced.

#### Business logic

A build against an empty workspace is opened with a prompt to create the app; a build against a workspace that already has content is opened with a prompt to extend what is there. A one-prompt agent is opened with the user's text placed into the framing's user slot, or entirely verbatim when vanilla. A transparent agent and a continuation are always opened verbatim.

The fake driver always takes the from-scratch path, because it writes nothing — its workspace always reads as empty — and its scripted demo must stay deterministic.

### Every turn's question is a gate

#### User story

The agent reaches a decision only the user can make. It presents the options, the user picks one, and the agent carries on from that answer. When nobody is watching, the agent must not sit there forever.

#### Business logic

A turn that ends by asking parks the agent as a gate: the question and its options are published, the user's pick is awaited, and the agent is re-prompted with the answer. An agent with no way to reach a user never parks — the recommended option is accepted automatically.

The number of consecutive gates within one exchange is capped. An agent still asking past that cap finishes with its latest turn rather than looping, and says in its log that it stopped because the await limit was reached.

### An answer that says stop ends the agent

#### User story

The user is shown a plan and declines it. The agent must stop there so the user can take over with fresh instructions — building on a plan they just declined is the one thing not to do.

#### Business logic

When the user picks an option the agent marked as stopping — during the opening exchange, mid-backlog, or in live chat — the agent ends. The stop is tripped through the agent's own stop signal, so it ends by exactly the same path as the Stop button, and its ending reads as stopped rather than as a completed agent.

The stop is checked again before the agent is allowed to settle as a success, both after the opening exchange and after the backlog and chat phases: those phases trip the signal but do not watch it themselves, and without the check a stopped agent would end as a success and publish the very work its answer declined.

#### Rationale

The prompt path used to finish cleanly on a decline instead of stopping, so the same decline read as a completed agent on one path and a stop on the other.

### A build that produced nothing is pushed once

#### User story

A user asks for an app and the coding agent spends its turn sanity-checking the stack instead of writing anything.

#### Business logic

When a build's opening exchange settles and the workspace is still empty, the agent is re-prompted once with a hard directive to create the app from scratch, and that turn's result becomes the agent's result. This applies only to a real driver — the fake driver writes nothing, so its workspace always reads as empty — never to a continuation, and never to an agent that was stopped. The gates have already been drained by this point, so the agent is never mid-question when this fires.

### The agent queue is worked after the opening exchange settles

#### User story

The user confirms a list of tasks and expects the agent to work through them without being asked again for each one.

#### Business logic

Once a build's opening work has settled, the agent consumes its own confirmed-task backlog, one gated entry per turn, until the backlog is empty. The agent's stop signal and an entry cap bound the loop, so an unattended agent cannot run indefinitely. The backlog loop runs only for a build, never for a hands-off agent, and is on by default for a real driver and off for the fake driver — whose scripted demo writes no backlog and must stay deterministic. The user can force it on or off explicitly.

### Live chat comes last

#### User story

The user sends the agent a follow-up while it is working, and expects it to be handled after the agent has finished what it was already doing — not in the middle of the backlog.

#### Business logic

A build takes the user's own messages only once its backlog is worked, so nothing comes between the backlog entries. A one-prompt agent takes them straight after its opening exchange, where there is nothing to come between. A stop answered during live chat ends the agent, exactly as one answered during the opening exchange does, rather than letting a stopped chat settle as a clean, published agent. Live chat exists only when a chat source is wired at all; a headless agent simply ends when the coding agent stops asking. Hands-off agents never take chat.

### A hands-off agent is its opening prompt and nothing else

#### User story

A user hands a task to a Claude Code cloud session. The dashboard must show the agent as handed off and finished, not as an agent that gave up a turn in.

#### Business logic

When the run target is hands-off, the opening prompt is the whole agent: the gates, the backlog loop and live chat are all dropped rather than fed, and the framing tells the coding agent so — nothing on this machine sees its workspace, so it has to commit its own work and open its own pull request. Before ending, the agent states in its log that the rest of the work happens in its own session, which opens its own pull request. The link to that session is already carried by the driver's own turn.

Whether that session is also told to decide every question alone is a separate switch the caller sets: it is told so only when the Claude web bridge is off. With the bridge on, its framing leaves the await gates exactly as a local agent has them, because a question it parks on is carried into the dashboard and the user's answer is typed back into it.

#### Rationale

Everything after the opening prompt would otherwise be reading the driver's own "handed off" summary as though the agent had written it, which put unanswerable questions on the dashboard for agents that were somewhere else entirely. That is about the *local* half of the agent, which really does end at the hand-off — it says nothing about whether the session on the other side may ask, which is what the bridge decides.

### The agent always ends with a verdict

#### User story

Whatever happens, the user sees how the agent ended, and nothing is left running behind it.

#### Business logic

An agent that completes publishes a successful ending. An agent that throws publishes a failed ending, marked as stopped when the user interrupted it or answered with a stop, and otherwise carrying the failure's own message. Either way, the coding agent's session is closed afterwards.

A continuation resumes the stopped agent's conversation rather than starting a new one, and its prompt is sent verbatim, because the resumed transcript already carries the framing — composing it again would stack a second preamble onto a conversation that lived through the first. Everything around the turn still runs: the gates, the backlog loop, live chat. The flow resumes, not just the conversation.

A surface listening to the agent's events that throws is ignored — with the failure logged — because the agent publishes events both inside and outside its own failure handling, and an unguarded failure there would either escape the agent uncaught or rob it of its ending.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
