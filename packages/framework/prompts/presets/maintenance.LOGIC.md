The "Maintenance" preset, both a launcher button and a routine [3]: the agent [1] analyzes the target for refactoring opportunities and, instead of refactoring, puts on the agent queue [2] one maintainability pass and one security audit per subset of the code that needs them, for later agents to work. Its tooltip in the launcher reads "Queue maintainability + security work per codebase subset (TODO_AGENTS.md)". The target is the preset's one parameter, "What to analyze for refactor opportunities", filled by the rule in `src/preset-prompt.ts`; left blank, it is the session the preset was launched from, or the "entire codebase" when there is none, which is what the routine runs over.

## Context

**User story**: a project that nobody touches still gets, on a calendar, a fresh set of queue entries asking for maintainability and security work on the parts of the code that need it; the user vetoes any entry before an agent works it, or clicks "Maintenance" in the launcher to get the same sweep on demand.

**Business logic story**: as a routine, the preset is fired by the daemon's Auto PM [4] on its own calendar, outside the rotation of the other routines (the rule in `src/auto-pm.ts`), because it looks at static history and would otherwise never come due. The two entries it queues name the presets written to the project's `.the-framework/presets/`, `maintainability.md` and `security_audit.md`, through the `${{ tf.presets.<stem>.filePath }}` fragments; the agent that later works an entry opens that file and runs it over the named subset.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[3] routine: a preset the daemon fires on its own on a schedule, each switchable off and runnable on demand.
[4] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[5] skill: one of the four capabilities an agent is taught (`branches`, `tickets`, `queue`, `logs`), each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.

## Business logic — TL;DR

- **Analyze, do not refactor** - the agent looks at the target for opportunities to refactor and queues the work instead of doing it.
- **Two entries per subset that needs them** - for each subset of the code that needs it, the agent adds to the agent queue, through `queue add "<entry>" --priority <N>` from the `queue` skill [5] and usually at a low priority, one entry applying `.the-framework/presets/maintainability.md` and one applying `.the-framework/presets/security_audit.md`, each with the preset's parameter set to a clear designation of that subset.
