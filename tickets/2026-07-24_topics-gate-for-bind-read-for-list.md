Status: open
Priority: 5
Topics: [question, the-framework]
GitHub: [#1129](https://github.com/gemstack-land/the-framework/issues/1129)

# Topics: recommend gate for bind + read for list (#1121 mechanism)

## TLDR

Mechanism decision for #1121 (part of #1115), with both options spiked end-to-end and CI-green: use an **await-gate** for `create_project`/bind (the agent ends its turn with an `await-create-project`/`await-bind-project` block; the framework shows Approve/pick, resolves, resumes) and a plain **context read** for `list_projects` (inject registered projects into the topic run's context; a tool only if the list gets large). Rationale: binding is a permission feature and a respawn (#1122 moves the run to the project's worktree), which a gate models natively — while agents run in `bypassPermissions`, so an MCP tool call would never prompt the user. Next: promote the gates spike (#1131), build #1122 re-home, retire the tools spike (#1130).

## Why it matters

This settles how the lazy-bind permission model actually works, with evidence instead of taste: the spike comparison (footprint, tests, permission-gate fit, respawn fit) and two unknowns resolved — neither approach needs to touch the drift-guarded `system_prompt.md` (the gate protocol lives in a runtime append layer), and UI/UX is identical either way (same `bind` event + `RunMeta.boundProjectId`), so the choice is purely internal.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1129](https://github.com/gemstack-land/the-framework/issues/1129), created 2026-07-24, labels: `question`, `priority: medium`, `the-framework ♻️`.

### Original description

**Recommendation: gate for the bind/create, read for the list.** Both approaches were spiked end to end and are green; evidence below. For #1121, part of #1115.

## The call

- **`create_project` / bind a project -> await-gate.** The agent ends a turn with an `await-create-project` / `await-bind-project` block; the framework shows Approve/pick, resolves it, resumes.
- **`list_projects` -> a read**, not a gate: inject the registered projects into the topic run's context (add a read-only tool later only if the list gets large/dynamic).

The issue framed both as "tools", but a pure read and a permission-carrying respawn are different shapes. Splitting them is cleaner than forcing one mechanism on both.

## Why a gate for the bind

1. **This is a permission feature** ("the confirmation is the permission gate"). A gate IS that gate: Approve/Decline, asked once per new project, autopilot auto-accepts, all for free. Agents run in `bypassPermissions`, so an MCP tool call does not prompt the user; to get the required approval you would rebuild the gate round-trip anyway.
2. **Binding is a respawn.** The run moves to the project's worktree (#1122), so it is a turn-ending transition. A gate models that. A tool returns a value mid-turn into a run that is about to be torn down.

## Why a read (not a gate) for the list

A pure read is naturally tool/context-shaped; ending a turn to read a list is awkward.

## Evidence from the two spikes (both draft, both CI green)

| | tools (#1130) | gates (#1131) |
|---|---|---|
| footprint | 6 files / +193 | 10 files / +249 |
| tests | 1260 | 1266 |
| base-prompt edit | none | none (runtime append layer) |
| permission gate | must bolt on | native |
| respawn fit (#1122) | fire-and-effect | native |

Findings that settled earlier unknowns:
- **Neither needs the drift-guarded system prompt.** The gate protocol lives in the runtime append layer (`system-prompt.ts`), appended only for topic runs; `system_prompt.md` is untouched.
- **UI/UX is identical either way.** Both feed the same `bind` event + `RunMeta.boundProjectId`; the approval routes through the existing choice panel. The mechanism choice is internal, not user-facing.
- The bind-recording code is byte-identical across the two spike PRs, so the diff between them is purely the trigger.

## Next once confirmed

Promote the #1131 gates spike to the real #1121 (add list-as-context, harden, fuller tests, changeset), then build #1122 re-home (allocate the worktree + continue-run into the chosen project). Retire the #1130 tools spike.
