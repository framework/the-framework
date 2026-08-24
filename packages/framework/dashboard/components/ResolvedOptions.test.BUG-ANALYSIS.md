# Bug analysis: packages/framework/dashboard/components/ResolvedOptions.test.tsx

## Business logic (high-level)

Pins four ResolvedOptions behaviors: nothing rendered when no option is on; on options listed by
label without the gear; a disabled option excluded even when its stored value is on ("not in
play, however it is stored"); and the provenance marking — a `sources`-repo option carries the
"repo" text and the the-framework.yml tooltip while a global one reads plain with the "Your
setting" tooltip. That matches the component SPEC's three TL;DR points.

Fixture realism: the rows helper builds three flag-style rows (`transparent`, `vanilla`,
`browser`) whose `key` IS the preference key — realistic for those rows. What the fixture does
NOT include is a publish-ladder row (`push`/`pr`/`merge`), whose key is a rung name rather than a
preference key; that untested shape is exactly where the component's provenance lookup fails (see
ResolvedOptions.BUG-ANALYSIS.md bug 1). A fixture row like
`{ key: 'pr', … }` with `sources: { handoff: 'repo' }` would currently fail against the
component — the gap in coverage is what let the bug survive. Noted as a coverage gap; the
existing tests themselves assert true things and can fail.

Async handling: the tooltip test awaits `hoverTooltip` (which retries the hover pair inside
`waitFor` — robust against slow listener attachment) and calls `unhoverTooltip` before hovering
the second chip so `getByRole('tooltip')` cannot match a leftover popup. Correct. The suite has
no `afterEach(cleanup)`, but the testing-library vitest setup used across this repo auto-cleans
(other suites rely on explicit cleanup; here each test renders fresh into its own container and
queries via `screen` with unique texts — the "renders nothing" test uses its own `container`), so
no cross-test bleed is possible in practice.

## Functions (low-level)

### `rows(over)`

Three `OptionRow`s with settable checked/disabled. `patch`/`title`/`description` filled minimally
— the component reads none of them except `key`, `label`, `checked`, `disabled`, so the fixture
is exactly sufficient. Correct.

### Test "renders nothing when no option is on"

`container.innerHTML === ''` — the strongest possible no-strip assertion. Correct.

### Test "lists the options in play without opening the gear"

Two on-labels present, the off one absent. Correct.

### Test "a disabled option is not in play, however it is stored"

`browser: true` + `disabled` → excluded. Pins the `!o.disabled` filter. Correct.

### Test "a value inherited from the repo yml is marked as not yours"

Asserts the "repo" suffix on the repo chip, its tooltip contains "the-framework.yml", the global
chip lacks the suffix, and its tooltip contains "Your setting". `repo.textContent` is the trigger
span's text (label + suffix span), so `toContain('repo')` genuinely detects the suffix. Correct —
but only for a preference-keyed row (see coverage gap above).

## Bugs found

None found (in the tests themselves; the component bug the fixture shape misses is filed against
ResolvedOptions.tsx).
