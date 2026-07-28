The Global run options as one pure-data table (#314) — `runOptionRows(preferences)` returns `{main, eco}` rows of `OptionRow` with every cross-option rule already applied.

## TLDR

- `OptionRow`: `key` (a `Preferences` key), `label`, `title` (tooltip), `description` (#654), `checked`, optional `disabled` + `disabledReason`.
- Main rows: Transparent, Autopilot, Technical control, Disable system prompt (vanilla), Eco, Post-merge cleanup (`onBeforeMergeableQuality`), Open PR (`autoOpenPr`), Auto-merge (`autoMerge`, #1216: default off, disabled while Open PR is off — nothing to merge), Browser. Eco sub-drops: `ecoPlanning`, `ecoResearch`, `ecoMaintenance`.
- Rules: Transparent (#625) is the master off-switch overriding everything below it; Eco is inert under Vanilla/Transparent (no system prompt left to trim); eco sub-drops need Eco in force; `ecoMaintenance` additionally needs Post-merge cleanup (#556 moved Maintenance into the on-before-mergeable prompt); Browser needs `agent === 'claude'` (#801, rides Claude Code's MCP config).

## Decisions

- Pure data, no JSX: the launcher renders it as dropdown items, the settings page (#958) as page rows — one table so the rules can't drift between the two surfaces (it used to be built inline in the composer).
- `checked` is the *effective* value, not the stored one: an option overridden by Transparent reads off, because that is what the run will do — a surface can never claim an option is on while the run ignores it.
- One `Open PR` row instead of the old `Push branch`/`Open PR` pair (#1164/#1173): PR implies push, so `Push branch` was greyed out almost always; push-without-PR stays reachable via the `autoPushBranch` key, `--auto-push-branch`, and `the-framework.yml`.
- `disabledReason` renders in the description because a disabled dropdown item takes no pointer events, so its tooltip never opens.
- Transparent's copy names the selected agent (#948) — "Raw Claude Code" was a lie under Codex; but the Browser rule tests the stored `agent` value directly (the label fallback to Claude is cosmetic).

## Facts

- Defaults: autopilot via `autopilotEnabled()` (default-on), handoff via `handoffFromPreferences()` (default-on #1102, and what makes PR imply push), `agent ?? 'claude'` (#650); everything else `?? false`.
- The launcher hides the eco sub-drops instead of greying them (renders them only while Eco is on), so the `ecoOff` disable only bites on surfaces listing them unconditionally.
