Renders the prompt of the on-before-mergeable follow-up: the one extra turn [1] an agent's [2] work gets, in a second agent started in the same checkout [3], after the agent signals ready for merge [4] and only when the user switched the follow-up on. The text is `prompts/on_before_mergeable_prompt.md` filled with the finished agent's session name [5] and the on-disk path of each quality preset, so the follow-up can put a maintainability pass and a security audit of exactly that agent's changes on the agent queue [6] and fold what the agent learned into the project's knowledge base. Rendering is all this file does; it runs nothing and queues nothing itself.

## Context

**User story**: with "Post-merge cleanup" on, the user finds, after an agent [2] finishes non-trivial work, one or two new entries on the agent queue [6], each naming the preset to apply and the changes to apply it to, and the project's `knowledge-base/` files gained what the agent decided, found out or understood.

**Business logic story**: when the follow-up fires, and why it is skipped, are rules in `cli.ts`; the outcomes it reports and the skip reasons are fixed in `events.ts`; what the prompt tells the follow-up agent is `prompts/on_before_mergeable_prompt.md`'s. This file only turns that template into the text the follow-up is prompted with.

## Glossary

[1] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[3] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[4] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[5] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[6] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.

## Business logic — TL;DR

- **The template is the shipped prompt** - the text is the generated copy of `prompts/on_before_mergeable_prompt.md`, used as it is; there is no per-project or per-user variant, and no option trims a section of it.
- **Every line carries the session name** - the rendering fills the finished agent's session name into each entry the prompt asks to queue and into the knowledge-base instruction; this is why the follow-up is skipped for an agent that never named its work, and why rendering without a session name is refused with an error that names the missing value rather than producing entries about "changes introduced by undefined".
- **The queued entries name real preset files** - each preset placeholder resolves to the path of that preset as written into the project, `.the-framework/presets/<stem>.md`, relative to the checkout because that is the follow-up's working directory; the standard map covers `maintainability`, `readability`, `security_audit`, `research`, `ux` and `maintenance`, a caller may hand in its own map of paths instead, and the prompt reads only the maintainability and security-audit paths.
