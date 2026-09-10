"Enhanced System Prompt": the disclosure on the launcher [1] that shows, in full and before anything is started, the exact system prompt the next agent [2] will run under — plus the two switches that decide how much of it there is. What it shows is assembled the same way the agent's own system prompt is assembled, so the user reads what The Framework really wraps their prompt in instead of taking its word for it.

## Context

**User story**: the user wants to know what The Framework adds to the prompt they typed, whether that addition can be turned off, and what is left when it is. The disclosure sits in the launcher's [1] row of resolved settings, closed by default, one click from the whole text.

**Problem**: a preview that reassembles the prompt in its own way would drift from what agents [2] actually receive, and a preview that showed most of the prompt would be worse than none: the user would trust it. So the text on screen is composed by the same rule the agent's own system prompt is composed by, and the panel states outright that nothing further is appended when the agent starts.

## Glossary

[1] launcher: the Start form on a project home, a project's own page with the prompt editor beside it.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] the built-in system prompt: the standing instructions every agent starts with; `SYSTEM.md` is the project's own instructions added on top.
[4] vanilla: an agent started without the built-in system prompt but with the signal protocols kept.
[5] transparent: an agent started with nothing of The Framework's — the raw coding agent.
[6] turn signals: what The Framework reads off a turn's final message: the ready-for-merge signal, the pull request title and body, markdown views, reported errors, and the gate it stops at.
[7] the agent Context: the set of other registered projects and individual files an agent is pointed at on top of its own project, carried into its system prompt as one `Context:` line.
[8] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[9] coding agent: the CLI doing the actual work: Claude Code or Codex.

## Business logic — TL;DR

- **The whole prompt, not a preview of it** - the panel shows the complete text the agent [2] will be started with, and says how long it is and that nothing else is added at start.
- **Two switches, two levels of The Framework** - one drops the built-in system prompt [3]; the other drops everything The Framework adds, leaving the raw coding agent [9].
- **The switches read the way the agent will behave** - turning the integration off forces the other switch to read as off and locks it, whatever is stored.
- **The closed state says at a glance whether anything is off** - a lit dot means both levels are fully on; any level off dims it, and the state is spelled out for assistive technology.
- **Nothing to show is said in words** - with everything off, the panel says so rather than showing an empty box.
- **The switches are the same settings the options gear writes** - they change the user's preferences [8], so the two surfaces cannot disagree about what the next agent gets.

## Business logic

### The whole prompt, not a preview of it

#### Context

See `## Context`.

#### Business logic

The panel opens with this explanation, verbatim: The Framework wraps your prompt with a so-called "system prompt" (it's just a prompt wrapping your prompt) in order to enable long-running autonomous agents. Below the two switches it shows the composed text in a scrollable block, followed by its length in characters, written with thousands separators, and the promise "This is the whole system prompt: nothing else is appended when the session starts."

The text is composed exactly as an agent's [2] system prompt is composed (the composition itself is `../../src/system-prompt.ts`), from what this launcher [1] will really send:

- the agent Context [7] line naming the other projects and files the agent is pointed at, followed by the pointers to the project's knowledge documents,
- the built-in system prompt [3],
- the project's own `SYSTEM.md`, read from the daemon,
- the section that tells the agent it has a real browser, when the agent is started with one,
- the protocols for the turn signals [6] the agent emits.

The prompt the user has typed rides inside the text as well, so the preview changes as the user writes.

### Two switches, two levels of The Framework

#### Context

**Business logic story**: there are two levels at which The Framework can be turned off. Dropping the built-in system prompt [3] leaves an agent [2] that still speaks the turn signals [6], so the dashboard keeps working; dropping the integration itself leaves nothing at all in the system prompt, and the coding agent [9] runs as if it had been invoked by hand.

#### Business logic

The panel has two checkboxes, each ticked when that level is on:

- "Anti-laziness and improved large-scope planning": the built-in system prompt [3]. Unticking it makes the next agent [2] vanilla [4] — the built-in instructions and the knowledge-document pointers go, and the turn signals [6] remain.
- "Integration with The Framework", with the muted aside "(some functionality stops working)": everything The Framework adds. Unticking it makes the next agent transparent [5] — an empty system prompt, the raw coding agent [9].

Both are unavailable while a start is in flight. The integration row is also fixed, rather than a control, where the surface showing the disclosure is not the one that decides it; it then only states which way that agent runs.

### The switches read the way the agent will behave

#### Context

**Problem**: the two levels are not independent — with the integration off there is no system prompt for the built-in instructions to be part of. A panel that still showed the built-in instructions as on would describe an agent [2] that does not exist.

#### Business logic

Turning the integration off is the master off-switch: the built-in system prompt [3] row then reads as off and cannot be changed, whatever the stored value says, and explains itself on hover with "Off while the framework integration is off". Ticking it back on restores the stored value.

### The closed state says at a glance whether anything is off

#### Context

**User story**: the user glances at the launcher's [1] settings row and wants to know whether this agent [2] gets The Framework in full, without opening anything.

#### Business logic

The closed control reads "Enhanced System Prompt" beside a status dot. The dot is lit only when both levels are on; either one off dims it — including the case where the built-in system prompt [3] is dropped but the turn signals [6] are still sent, because that is still not the full prompt. Assistive technology is told which of the two it is, as " (fully enabled)" or " (not fully enabled)".

### Nothing to show is said in words

#### Context

**Problem**: with the integration off there is no text at all. An empty box would read as a failure to load.

#### Business logic

When the composed text is empty, the panel says "No extra system prompt: only the built-in system prompt of your AI model provider." in place of the text block, its length and the "nothing else is appended" line.

### The switches are the same settings the options gear writes

#### Context

**Problem**: the same two levels are offered by the launcher's [1] options gear and by the Settings page. Three surfaces writing three values would let one of them describe an agent [2] the others would not start.

#### Business logic

Both checkboxes write the user's preferences [8] directly, the same values the options gear and the Settings page write. They are not settings of their own, so whatever is changed here is what every other surface shows immediately.
