Priority: 2
Topics: [skills, presets]
GitHub: [#1770](https://github.com/framework/the-framework/issues/1770)

# Replace presets in favor of skills with `disable-model-invocation`

## TLDR

Replace the framework's presets with skills that set `disable-model-invocation: true`, so only a person (or the daemon) fires them. The UI can probably stay the same.

Started: the queue drain became the first such skill, `work-queue`, fired as `/work-queue` (#1774 daemon half, #1777). The other presets follow one at a time.

See:
- https://code.claude.com/docs/en/skills#control-who-invokes-a-skill
- https://agentskills.io/client-implementation/adding-skills-support#filtering

## Why it matters

Presets are framework-only prompts; as skills they work in any harness and fit the skills architecture. Labeled low priority.

## Source

Imported from GitHub issue [framework/the-framework#1770](https://github.com/framework/the-framework/issues/1770), created 2026-09-09, labels: `low-prio`.
