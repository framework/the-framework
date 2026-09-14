Priority: 2
GitHub: [#1770](https://github.com/framework/the-framework/issues/1770)

# Replace presets in favor of skills with `disable-model-invocation`

## TLDR

Turn the framework's presets into skills with `disable-model-invocation: true`, so only a person (or the daemon) fires them, never the model on its own. The UI can probably stay the same. References: [Claude Code: control who invokes a skill](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill), [agentskills.io: filtering](https://agentskills.io/client-implementation/adding-skills-support#filtering). Started via #1774/#1777: the queue drain is the first preset converted (`work-queue/SKILL.md` in `@gemstack/routines`, fired as `/work-queue`), and the rest follow one at a time.

## Why it matters

Presets are framework-only prompt files. As skills they run in any harness that supports skills, show in the "/" list like any other skill, and fit the routine/capability split from #1774.

## Source

Imported from GitHub issue [framework/the-framework#1770](https://github.com/framework/the-framework/issues/1770), created 2026-09-09, labels: `low-prio`, 0 comments.
