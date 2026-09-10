Joins the preset registry with the preset catalog on the daemon's side: the six quality presets that materialize to disk (maintainability, readability, security audit, research, UX and maintenance), keyed by their file stem, and the act of writing each of them, with its target blank left unrendered, to `.the-framework/presets/<stem>.md` under a checkout [1], so that a queue entry [2] naming a preset by its path points at a real file the agent [3] can open.

## Context

**User story**: an agent that signals ready for merge [4] gets an extra turn that queues quality follow-ups such as "Apply `.the-framework/presets/maintainability.md` with tf.params.what set to changes introduced by <session name>"; the agent that later drains [5] that entry opens the file at that path and applies it to the target the entry names. The "Maintenance" routine [6] queues the same kind of entry per codebase subset.

**Business logic story**: the registry in `preset-registry.ts` names the stems and the paths and touches nothing on the machine, so presets render in the browser; the catalog in `preset-catalog.ts` owns the prompts; this file is the one place the two meet, so a stem without a prompt cannot exist unnoticed.

## Glossary

[1] checkout: An agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch. The user's own working copy is "the project's checkout".
[2] queue entry: An item on the agent queue, `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.
[3] agent: The unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] ready for merge: The signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[5] drain: Starting an agent on the agent queue's first open entry — the half of Auto PM that spends existing work.
[6] routine: A preset the daemon fires on its own on a schedule — update tickets, triage quick, triage consensual, plan tickets, maintenance — each switchable off and runnable on demand.

## Business logic — TL;DR

- **The materialized presets** - the catalog's rows whose name, with hyphens turned into underscores, is one of the registry's six stems, keyed by that stem; a stem with no catalog row simply vanishes from the set, which the tests turn into a failure.
- **Materializing** - the six prompts are written verbatim, target blank unrendered, to `.the-framework/presets/<stem>.md` under the given checkout, overwriting whatever is there; this happens when a project is activated and again before an agent's ready-for-merge follow-up.

## Business logic

### The materialized presets

#### Context

See `## Context`.

#### Business logic

The set of presets that land on disk is derived, never listed twice: every row of the catalog whose name, with each hyphen replaced by an underscore, is one of the registry's stems (`maintainability`, `readability`, `security_audit`, `research`, `ux`, `maintenance`) is included under that stem, with its prompt exactly as shipped. A registry stem that no catalog row matches is silently absent from the set; the exact-set check in `presets.test.ts` is what makes that absence a failure rather than a missing file nobody notices.

### Materializing

#### Context

**Problem**: the package ships the presets compiled into its code, so they exist on disk only once written; the files are git-ignored under `.the-framework/`, so a fresh clone or a project activated before a preset shipped has none of them, while a queue entry [2] still names one by path.

#### Business logic

Materializing creates `.the-framework/presets/` under the given directory and writes every materialized preset to `<stem>.md` there, text unchanged. Each file keeps its target blank, `${{ tf.params.what }}`, unrendered: the queue entry that names the file tells the agent [3] what to set it to. Existing files are overwritten, so activating a project again refreshes them to the installed version of The Framework instead of leaving the version the repository was activated with. It runs in two moments: when a project is activated, in the project's checkout [1] (`install.ts`), and in the agent's checkout before the ready-for-merge [4] follow-up queues its entries (`cli.ts`), where a failure to write is reported and does not block the queueing.
