# Bug analysis: packages/framework/dashboard/components/PresetsMenu.tsx

## Business logic (high-level)

The composer's presets button (#948): the single surface that loads, creates, and deletes presets.
Per SPEC: three groups (built-ins, "Your presets", "Project presets"), empty groups hidden; picking
a preset loads its prompt into the editor (never auto-sends); built-ins may carry `newAgent` which
is forwarded on load (#959) while custom presets are always plain loads; every custom row carries a
delete control; "New preset…" appears only when `onNew` is provided.

Invariants checked:

- Group hiding: `customPresets.length > 0 &&` / `projectPresets.length > 0 &&` guards — matches
  SPEC ("A group with nothing in it is not shown"). The built-in group is always rendered; callers
  always supply the built-in list, so an empty built-in group is not a state this system produces.
- `newAgent` forwarding: built-in rows call `onLoad(p.render(), p.label, p.newAgent)`; saved rows
  call `onLoad(preset.prompt, preset.label)` — custom presets can never claim `newAgent`, matching
  the SPEC's "A custom preset is always a plain load".
- Slash-name teaching: each built-in row renders `<OptionLabel label description={`/${p.id}`}/>`,
  matching "Every built-in preset row shows its label together with the `/` command".
- Deletion routing: user rows get `onDelete`, project rows get `onDeleteProject` — the same
  `SavedPresetRow` is reused with the appropriate handler, so a project preset cannot be deleted
  through the user-preset RPC.
- `busy` disables the trigger and every item and the per-row delete buttons; no action can fire
  mid-mutation.

Concurrency/ordering: the component is stateless (all state lives in the parent), so there is
nothing to race. `render()` is invoked at click time, so a built-in prompt reflects the surface
state at the moment of the pick, not at menu-open time — correct for prompts that interpolate
current context.

## Functions (low-level)

### `PresetEntry` (interface)

Built-in preset shape: `id`, `label`, `render(): string`, optional `tooltip`, optional `newAgent`.
No logic. Correct.

### `SavedPresetRow({ preset, busy, onLoad, onDelete })`

One saved-preset row. Row click → `onLoad(preset.prompt, preset.label)`. The delete affordance is a
`TooltipTrigger render={<button …/>}` whose click handler calls `e.stopPropagation()` before
`onDelete(preset.id)` — the stopPropagation keeps the enclosing `Menu.Item`'s own click handler
from also loading the preset (pinned by the test "the delete button deletes without loading").
Edge cases:

- `busy` disables both the row and the delete button.
- The `X` icon is passed as TooltipTrigger children and merged into the rendered `button` (Base UI
  `render` prop semantics) — the icon does render inside the button; the button is never empty.
- Nested interactive element (button inside `role=menuitem` div): Base UI items are divs, so no
  invalid `<button><button>` nesting.
- Long labels truncate (`flex-1 truncate`); the delete button never collapses.
- Duplicate preset ids would collide as React keys, but ids are generated unique by the store.

Verdict: correct.

### `PresetsMenu({ presets, customPresets, projectPresets, busy, onLoad, onNew, onDelete, onDeleteProject })`

Renders the trigger (icon button with tooltip pointing at the `/` shortcut, matching SPEC) and the
menu content. Built-in rows: with a `tooltip`, the row is wrapped
`<Tooltip><TooltipTrigger render={<DropdownMenuItem …/>}>…` so the hint shows on hover (SPEC:
"Built-in presets that carry an explanation show it on hover"); without one, a bare item — both
paths receive identical `itemProps` (disabled/onClick/className), so behavior does not diverge.
Separators precede the second and third groups and the "New preset…" item only when those render,
so no dangling separator appears for empty groups or when `onNew` is absent (pinned by tests).
Edge cases:

- `onNew` absent → no create entry (SPEC: "when a create dialog is available on this surface").
- `busy` also disables the trigger itself, so the menu cannot even open mid-action — slightly
  stronger than needed but consistent with the composer's busy semantics.
- Tooltip-over-menu stacking is handled in `ui/tooltip.tsx` (#1506), not here.

Verdict: correct.

## Bugs found

None found.
