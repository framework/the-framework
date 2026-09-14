Effort: 6
Uncertainty: 6
# [Plan] Replace presets in favor of skills with `disable-model-invocation`

How to turn the framework's 14 presets into command skills like `work-queue`, what blocks it, and the picks a person has to make first.

## TLDR

`/work-queue` (#1777, #1779) already shows the pattern: one package `@gemstack/skill-<command>`, a `SKILL.md` at its root with `disable-model-invocation: true`, linked into every checkout through `COMMAND_SKILLS` (`packages/framework/src/daemon-runtime.ts:130`), fired as `/<name>`. The remaining 14 presets live in `packages/framework/prompts/presets/*.md`. They are wired through `src/preset-catalog.ts` (label, tooltip, `newAgent`, launcher order), `src/preset-prompt.ts` (the `${{ tf.params.what }}` template), `src/presets.ts` + `src/preset-registry.ts` (6 presets copied to `.the-framework/presets/`), `src/auto-pm.ts:316-388` (the rotation and the maintenance job), `src/cli.ts:1260` (Research), and the dashboard (`Composer.tsx:158`, `PresetsMenu.tsx:119`, `PromptEditor.tsx:216`, `UpdateTicketsButton.tsx:14`).

The move itself is mechanical. The blockers are four design questions (below). Recommended order: get the picks, then move the 4 rotation presets + maintenance (daemon-fired), then the launcher-only ones.

## Problems

1. **Queue entries point at presets, and `disable-model-invocation` blocks exactly that use.** `maintenance.md` and `prompts/on_before_mergeable_prompt.md` queue entries like "Apply `.the-framework/presets/maintainability.md` with tf.params.what set to X". A later `/work-queue` agent then opens that file. If `maintainability` becomes a skill marked `disable-model-invocation`, the queue agent cannot invoke it through its Skill tool, and there is no file path to open. (uncertainty 7)
2. **The `what` parameter.** Five presets (research, readability, maintainability, security audit, ux; maintenance too) take `${{ tf.params.what }}`, which defaults to the launching session's name or "entire codebase" (`preset-prompt.ts:9`). A skill takes free text after the command (`/readability src/foo`, `$ARGUMENTS` in Claude Code). The session-name default must become prose in the SKILL.md ("no target given: the changes on your branch, or the whole codebase"). (uncertainty 3)
3. **Codex.** `DRIVERS = ['claude', 'codex']` (`src/driver-names.ts:21`). Skills are linked into `.agents/skills/` for Codex, but nothing in `agent-driver/src/codex.ts` turns a `/name` prompt into the skill. Whether `codex exec` expands `/work-queue` is unverified. This already affects `/work-queue` today. (uncertainty 6)
4. **Launcher UI.** "The UI can probably stay the same", but the launcher shows and edits the rendered preset text in the prompt editor (`Composer.tsx:162`, `PromptEditor.tsx:216`). With skills, the editor would hold `/readability <what>`, and the text lives in `node_modules`, which the browser cannot import. Labels and tooltips also need a home: SKILL.md front matter (`description`) or a table kept in the framework. (uncertainty 6)
5. **Package count.** "One package per command" (`skill-work-queue/DECISIONS.md`) means 14 new packages, each with `package.json`, SKILL.md, LOGIC.md and DECISIONS.md, plus 14 framework dependencies. (uncertainty 4)
6. **Framework words inside the presets.** `triage_quick.md` / `triage_consensual.md` say "Always set <SESSION_NAME> to triage-quick" and get `triage_scope.md` appended; `plan_tickets.md` and the triages name the `tickets` and `queue` skills and commands. The DECISIONS rule is that a command assumes no capability and names no skill. Each text needs a rewrite into capability words, not a copy. (uncertainty 4)

## Solutions

1. Queue entries:
   - a. **(recommended)** The quality skills (maintainability, security audit, readability, research, ux) do *not* get `disable-model-invocation`. A queue entry then says "Run the maintainability skill on X", and the model may invoke it. Only the jobs a runner fires (work-queue, update-tickets, both triages, plan-tickets, maintenance) stay marked. Breaks the ticket's literal "every preset" wording, so it needs a person's OK.
   - b. Keep `disable-model-invocation` everywhere. The queue entry gives the linked path (`.claude/skills/maintainability/SKILL.md`) and the agent reads it as a file. Fails for Codex (`.agents/skills`) unless the entry names both paths, and it ties queue text to a harness.
   - c. The daemon recognizes a queue entry starting with `/name` and starts that command. This brings back the daemon reading the queue, which #1777 removed. Not recommended.
2. `what`: `/command <free text>`. The SKILL.md says what an empty argument means. The daemon's maintenance job sends `/maintenance` with no argument (entire codebase). Research in the CLI (`cli.ts:1260`) sends `/research <intent>`.
3. Codex: spike first, one real `codex exec "/work-queue"` run on the dogfood rig. If it does not expand, either (a) the Codex driver rewrites a leading `/name` into Codex's own skill mention, or (b) the framework sends the SKILL.md body as the prompt for Codex only. Decide from the spike's result.
4. Launcher:
   - a. **(recommended)** Keep one small table in the framework, `COMMAND_SKILLS` grown into `{ name, label, tooltip, newAgent, takesTarget }`. The buttons put `/<name> ` in the editor (the target typed after it). The full text shows via a new RPC that reads the SKILL.md, only for the "show prompt" preview.
   - b. Build-time generated constants from each package's SKILL.md (like `prompts.generated.ts` today), so the editor still shows full text. Editing the text then means sending an edited copy, not the skill. It keeps the UI identical but the skill and what runs can drift.
5. Packages: follow the decision, one package per command. Shortcut: land the 6 daemon-fired ones first. Alternative for a person to weigh: one `@gemstack/skill-quality` for the 5 targeted passes. That contradicts a recorded decision, so only on request.
6. Rewrite each text to capability words ("the project's tickets", "the agent queue"), the way `work-queue/SKILL.md` does, and fold `triage_scope.md` into both triage skills. Drop "Always set <SESSION_NAME>" (the routine lock, not the branch name, prevents double triage: `auto-pm.ts:322-335`).

## Considerations

- `pinnedPlanJob` (`auto-pm.ts:270`) appends the one-ticket pin to the job prompt. With `/plan-tickets` as the prompt, the pin becomes the command's arguments; the SKILL.md must say "if you are told which single ticket to plan, plan only that one".
- Routine locks (`lock: presets.triageQuick.name`) and `fansOut` stay on `AutoPmJob`; only `prompt` changes to `/<name>`.
- `AUTO_PM_JOBS` / `AUTO_PM_MAINTENANCE_JOB` labels and tooltips currently come from the catalog; they move to the table from Solution 4.
- Presets that end in a gate (Research, Suggest tickets to work on) stay out of the rotation; unchanged.
- `newAgent` (Update from GitHub) is a launcher property, not a skill property: keep it in the framework table.
- Custom presets (user-saved prompts, `project-presets.ts`, `.the-framework/custom-presets.json`) are not in scope; they stay plain prompts.
- `.the-framework/presets/` materialization (`presets.ts`, `install.ts:55`, `cli.ts:1429`) and `tf.presets.*.filePath` go away entirely once Problem 1 is solved. `on_before_mergeable_prompt.md` gets rewritten to queue "run the maintainability skill on the changes of <session>".
- `prompts.generated.ts` loses the `PRESETS_*` constants; `triage_scope.md` goes.
- Every changed file has a LOGIC.md sibling (`prompts/presets/LOGIC.md`, `auto-pm.LOGIC.md`, dashboard components). Regenerate them per the `logic-driven-development` skill. Delete the `prompts/presets/*.LOGIC.md` files with their presets.
- A project gets the skills only in checkouts the daemon makes. A person running Claude Code in the main checkout has no `/readability` unless the project installs the package. Probably fine (same as `/work-queue` today); mention it in the PR.
- Tests to update: `presets.test.ts`, `auto-pm.test.ts`, `daemon-workspace.test.ts:677` (exact linked-skill list), `daemon-services.test.ts`, `PresetsMenu.test.tsx`, `Composer.test.tsx`, `PromptEditor.test.tsx`, `StartAgentForm.test.tsx`.
- FEATURES-SPEC.md is gone per memory; if present, update it.
- Do not stack PRs: each step branches from main after the previous merge.

## Implementation

0. **Picks from a person** on Problems 1, 4 and 5 (post them on #1770; do not build before). Codex spike (Problem 3) at the same time, ~$1 on the rig.
1. **PR 1: the daemon-fired jobs.** New packages `skill-update-tickets`, `skill-triage-quick`, `skill-triage-consensual`, `skill-plan-tickets`, `skill-maintenance`, same shape as `skill-work-queue`. Add them to `COMMAND_SKILLS`. `AUTO_PM_JOBS` and `AUTO_PM_MAINTENANCE_JOB` send `/<name>`. Launcher buttons for these five send the slash command. Remove their catalog rows, prompt files and generated constants. Maintenance's queue entries follow the pick from Problem 1.
2. **PR 2: the quality passes.** `skill-research`, `skill-readability`, `skill-maintainability`, `skill-security-audit`, `skill-ux`. `what` becomes the argument. Remove `.the-framework/presets/` materialization, `preset-registry.ts`, `presets.ts`; rewrite `on_before_mergeable_prompt.md`. `cli.ts:1260` sends `/research <intent>`.
3. **PR 3: the rest.** `skill-suggest-new-tickets`, `skill-suggest-new-features`, `skill-suggest-tickets-to-work-on`, `skill-market-research`. Delete `preset-catalog.ts` and `preset-prompt.ts` once empty; the launcher reads the table from Solution 4.
4. Each PR: LOGIC.md regenerated for touched files, DECISIONS.md bullets only as proposals for a person, tests green, dogfood one daemon tick (rotation) on the rig before merge.
