The follow-up an agent's [1] work gets after the agent signals ready for merge [2], when the user switched the launcher's "Post-merge cleanup" option on: a second agent, started vanilla [3] in the finished agent's checkout [4] on its branch, is told to put a maintainability pass and a security audit of the session's changes on the agent queue [5] when the changes warrant one, and to fold what the session learned into the project's knowledge base. It queues the quality presets rather than running them: one short turn that writes a few queue entries, which a later drain [6] works.

## Context

**User story**: with the follow-up switched on, the user finds, after an agent finishes non-trivial work, one or two new entries on the agent queue [5] asking for a maintainability pass or a security audit of exactly that agent's changes, and the project's `knowledge-base/` files gained what the agent decided, found out or understood; the user can still remove a queued entry before any agent works it.

**Business logic story**: the rule in `src/cli.ts` fires the follow-up at most once per agent [1], only for an agent started with the follow-up option (the preference is off by default), and only after the agent signaled ready for merge [2]; it is skipped, and the skip shown in the dashboard as the follow-up's outcome, when the agent never signaled, was stopped, is a fake run, or never named its work. Before the follow-up starts, the quality presets are written to the project's `.the-framework/presets/` so the file paths the queued entries name exist. The follow-up runs vanilla [3] so it never runs the built-in system prompt's session-name step and never renames the branch: its output stays on the finished agent's branch and rides to review with the work. A follow-up never triggers a follow-up of its own. It is best-effort: when it does not complete cleanly the outcome is "incomplete", a line says "on-before-mergeable queueing did not complete cleanly.", and the handoff [7] proceeds regardless.

The text is a template: `${{ tf.session_name }}` is the finished agent's session name [8], read off its branch, and `${{ tf.presets.<stem>.filePath }}` is the path of a preset written to the project, `.the-framework/presets/maintainability.md` and `.the-framework/presets/security_audit.md` here.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[3] vanilla: an agent started without the built-in system prompt but with the signal protocols kept.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[6] drain: starting an agent on the agent queue's first open entry; the half of Auto PM that spends existing work.
[7] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local`, `push`, `pr` (the default), `merge`.
[8] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[9] skill: one of the four capabilities an agent is taught (`branches`, `tickets`, `queue`, `logs`), each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.

## Business logic — TL;DR

- **Queue through the skill, never edit the file** - a queue entry is added with `queue add "<entry>"` from the `queue` skill; the prompt never has the agent run a quality preset itself.
- **Queue a maintainability pass and a security audit when warranted** - non-trivial changes with refactor potential queue a maintainability pass over "changes introduced by <session name>"; changes that could lead to security issues queue a security audit over the same scope.
- **Fold what was learned into the knowledge base** - the decisions, non-obvious facts and insights of the session go into three files under `knowledge-base/`, created when missing, and only what a future agent needs and cannot get from the code.

## Business logic

### Queue through the skill, never edit the file

#### Context

See `## Context`.

#### Business logic

The prompt opens by defining its one macro, "TODO_FILE": the agent queue [5], `TODO_AGENTS.md`, to which an entry is added with `queue add "<entry>"` from the `queue` skill [9]. Everything the prompt asks to queue goes through that command; the file itself is never edited.

### Queue a maintainability pass and a security audit when warranted

#### Context

**Problem**: running three quality presets right after every agent [1] would cost three full passes serialized on the same checkout [4] and would not compose with the agent queue [5], where the user can still veto work; a queue entry is one line that a drain [6] works later, under the same quota rules as any other entry.

#### Business logic

The agent [1] judges the changes introduced by the finished agent's session name [8]:

- When they are not trivial and have refactor potential, it queues the entry: Apply `.the-framework/presets/maintainability.md` with `tf.params.what` set to "changes introduced by <session name>".
- When they can potentially lead to security issues, it queues the entry: Apply `.the-framework/presets/security_audit.md` with `tf.params.what` set to "changes introduced by <session name>".

Both, one or neither may be queued. The entry names the preset's file on disk and the scope the preset's one parameter is to be set to, so the agent that later works the entry opens the real preset file and runs it over exactly those changes.

### Fold what was learned into the knowledge base

#### Context

**Business logic story**: the three files are the same ones every agent [1] is told to read at the start through the context list that precedes the built-in system prompt (the rule in `src/system-prompt.ts`), so an agent is never told to read one set of files and update another.

#### Business logic

Unless it already did, the agent [1] considers updating, based on the changes and the discussions of the session:

- `knowledge-base/DECISIONS.md`: decisions taken, and why.
- `knowledge-base/FACTS.md`: non-obvious facts relevant to the project.
- `knowledge-base/INSIGHTS.md`: insights relevant to the project.

It may create a file that is missing. It writes only what a future agent would need and cannot get from the code itself.
