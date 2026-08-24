# Bug analysis: packages/framework/dashboard/components/ResolvedOptions.tsx

## Business logic (high-level)

The "Settings:" strip under the launcher (#842). SPEC invariants:

- **Only what is on**: `options.filter(o => o.checked && !o.disabled)` — off options and options
  that cannot apply (disabled) are excluded; empty → `return null` (no strip). Holds. Note that
  `checked` is already the *effective* value (agentOptionRows documents that an option overridden
  by Transparent reads as off), so the strip cannot claim an option the agent will ignore.
- **The strip and the gear cannot disagree**: the `options` prop is the very same `OptionRow[]`
  the gear renders (Composer passes `mainOptions` to both). Holds structurally.
- **Whose setting it is**: `repo: sources[o.key as keyof Preferences] === 'repo'` — repo chips get
  a dashed outline, a "repo" suffix, and the committed-file tooltip; others the "Your setting,
  from the options gear" tooltip. Holds for the flag rows (`transparent`, `vanilla`,
  `onBeforeMergeableQuality`, `browser`), whose `key` IS the preference key — but **breaks for the
  publish ladder**, bug 1 below.

## Functions (low-level)

### `ResolvedOptions({ options, sources })`

Pure projection: filter → chip models → render. Edge cases:

- All options off/disabled → null (pinned by tests).
- Chip keys unique (row keys are unique in `agentOptionRows`). React keys fine.
- The `as keyof Preferences` cast is the visible seam of bug 1: it silences exactly the type
  error that would have flagged the non-preference row keys.
- Tooltips wrap each chip; long labels just wrap the flex row. No state, no effects.

Verdict: bug found (provenance lookup).

## Bugs found

1. `L23`: the publish-ladder chips can never be tagged "repo". `OptionRow.key` is documented
   (lib/agent-option-rows.ts) as "a preference key for most rows; for the three publish rungs it
   is the rung's name" — `'push' | 'pr' | 'merge'` — while the stored preference all three write
   and read is the single `handoff` ordinal. `sources` is keyed by preference name, so
   `sources['push'|'pr'|'merge']` is always `undefined` and `repo` is always false for those
   rows. Concrete scenario: a repo commits `handoff: merge` in its `the-framework.yml`
   (explicitly supported — `preferencesFromFileConfig` maps it, and its comment says publishing
   "is a fact about the repo, so the committed file may say it"); the launcher strip then shows
   "Push branch", "Open PR" and "Auto-merge" as plain filled chips whose tooltip claims "Your
   setting, from the options gear" — the user is told an auto-merge they never chose is their own
   setting, the precise misinformation the SPEC's "Whose setting it is" story exists to prevent
   ("Being told which values are not the user's own is the point"). Severity: minor (wrong
   provenance labeling, no behavioral effect on the run). Confidence: high — verified the yml
   carries `handoff`, `sourceSnapshot` records `handoff: 'repo'`, and no code maps rung keys to
   it. Fix: resolve the lookup key first, e.g.
   `const prefKey = o.key === 'push' || o.key === 'pr' || o.key === 'merge' ? 'handoff' : o.key`
   and use `sources[prefKey as keyof Preferences]` (or add a `sourceKey` field to `OptionRow` in
   agent-option-rows.ts so the mapping lives beside the keys it is about).
