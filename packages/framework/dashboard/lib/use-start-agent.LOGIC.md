Starts an agent [1] for a project [2] from the dashboard, and reports back what the user needs to see: that the start is in flight, why it was refused, and which agent was started.

## Context

**User story**: the user writes a prompt in the launcher [3] and starts an agent, or picks a preset [4], or continues a finished agent from its composer, or starts one from the agent queue [5] card or the onboarding checklist. While the start is in flight the button is busy; when the daemon refuses, the reason appears on the surface the user started from; when it succeeds, the dashboard opens the agent that was just started.

**Problem**: a project can only have one agent per checkout [6], and the daemon refuses a start that would collide with one already active. That refusal has to read the same on every surface that starts an agent, rather than each surface inventing its own wording.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] project: a repository the user registered in the dashboard, identified by an id derived from its path.
[3] launcher: the Start form on a project's own page.
[4] preset: a canned prompt the user launches from the dashboard.
[5] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[6] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[7] build agent / prompt agent: the two kinds of agent: a build works the agent queue after its opening exchange; a prompt agent runs one prompt and stops there.
[8] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.

## Business logic — TL;DR

- **What a start sends** - the project, the prompt, which kind of agent it is, and the rest of the launcher's configuration as options.
- **The refusal the user reads** - a start refused because an agent is already active for the project says "An agent is already active for this project."
- **Any other failure keeps its own words** - the daemon's own reason, or the caller's fallback wording when there is none.
- **How the started agent is selected** - a successful start answers with the started agent's id, and the dashboard opens that agent.

## Business logic

### What a start sends

#### Context

See `## Context`.

#### Business logic

A start carries four things: which project [2] to start in, the prompt text, which kind of agent [1] it is — a build agent [7], a prompt agent, or one of the research-style presets [4] whose prompt may be left empty — and the rest of the launcher's [3] configuration as options. Every surface that starts an agent sends the same thing, so the launcher, a preset, the agent queue [5] card, the onboarding checklist and a finished agent's continuation all reach the daemon the same way.

While the start is in flight, the surface reports it as busy, and the reported failure from any previous attempt is cleared. Busy ends when the daemon answers, whether it succeeded or not.

### The refusal the user reads

#### Context

**Problem**: the daemon phrases its refusal for its own log. On screen the user needs to be told what happened to them, in the same words wherever they started from.

#### Business logic

A start the daemon refuses because an agent [1] is already active for that project [2] is reported as "An agent is already active for this project.", replacing whatever the daemon called it.

### Any other failure keeps its own words

#### Context

**Problem**: a start can fail for reasons the user can act on — an empty prompt, an unreachable daemon — and blanking those into one generic message would hide what to fix.

#### Business logic

Any other refusal is reported with the reason the daemon gave. A failure that carries no reason of its own, such as the daemon not answering at all, is reported with the wording the calling surface supplies, which defaults to "Failed to start the agent." The reported failure stays on screen until the surface clears it or the next start begins.

### How the started agent is selected

#### Context

**Problem**: several agents [1] can run in one project [2] at once, so the agent just started cannot be found by looking for "the running one". It also has not yet written anything the daemon's agent list can see.

#### Business logic

A successful start answers with the agent id [8] the daemon allocated, which it has whenever the agent got a checkout [6] of its own. The dashboard navigates to that agent as a new entry in the browser history, so Back returns to where the start was made, and shows the agent's live feed on the strength of that id before its row exists in the agent list.

When a start answers without an id, the dashboard lands on the project instead and adopts the project's running agent as the selection once the agent list surfaces it, correcting the address in place rather than adding a second history entry. A start that did not succeed answers with nothing, and the surface stays where it is.
