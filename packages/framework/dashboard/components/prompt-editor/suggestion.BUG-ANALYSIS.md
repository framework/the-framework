# Bug analysis: packages/framework/dashboard/components/prompt-editor/suggestion.ts

## Business logic (high-level)

Wires one `@tiptap/suggestion` trigger to the React `SuggestionList`: a fixed-position portal at
the caret, key events forwarded to the list, and the combobox a11y contract on the editor DOM
(`aria-expanded` + `aria-activedescendant`) while a menu is visible. `aria-expanded` doubles as
the editor's Enter-to-send guard (#1510): PromptEditor reads it to decide whether Enter picks or
sends, so the attribute must track *visibility*, not the plugin's armed state — which `draw()`
does (`visible = items.length > 0 || !!note`).

Lifecycle audit against @tiptap/suggestion 2.27.2 (read from node_modules):

- The plugin calls `onExit` before `onStart` when a suggestion moves+changes, so the module-level
  `el/root/listRef` slots are never double-allocated; `onStart` after `onExit` re-creates them.
  No portal or listener leak: `onExit` removes both window listeners added in `onStart`, unmounts
  the root and removes the element. Editor destroy also calls `onExit` (plugin view `destroy`).
- Menu tracking: `getRect` is refreshed on every update, and capture-phase `scroll` plus `resize`
  reposition the portal — matches the SPEC's "follows the caret".
- `place()` flips above the caret when fewer than 320px remain below (max-h-72 = 288px + offsets).
  No horizontal clamp: a caret near the right edge can push the 256px-wide menu partly off-screen.
  The SPEC only promises the bottom flip, so noted, not reported.
- Mistyped query: `note` only when `items.length === 0 && !props.query`, so a query that matches
  nothing hides the menu (display:none) while the plugin stays armed — per SPEC.

## Functions (low-level)

- `place(el, rect)` — null rect → leaves previous position (first call: element at default flow
  position of a fixed div, effectively top-left). `clientRect` is null only when the decoration is
  missing, which does not happen for an active suggestion. Verdict: correct.
- `makeRender(config)` — closure state per lifecycle; see lifecycle audit. Verdict: correct except
  the cross-trigger aria issue below (bug 2) and Escape (bug 1).
  - `setActive(id)` — writes/removes `aria-activedescendant` on the editor DOM. Correct.
  - `draw(props)` — computes note/visibility, toggles portal display, mirrors `aria-expanded`,
    renders the list. `root.render` is async (React 18): `listRef` is null until commit, so a key
    pressed in the same tick as `onStart` falls through to the editor. Harmless. Verdict: correct.
  - `onKeyDown` — Escape returns `false` "leaving it to the editor" (comment), everything else
    goes to the list. **But nothing in the stack handles Escape** (verified: @tiptap/suggestion
    2.27.2's `handleKeyDown` only delegates back here; no Escape binding exists in @tiptap/core,
    prosemirror-commands, or any dashboard component). See bug 1.
  - `onExit` — cleans up, sets `aria-expanded="false"` unconditionally. See bug 2.
- `makeTrigger(config)` — one Extension per trigger, own PluginKey, lowercased query. Correct.

## Bugs found

1. `L116`: **Escape does not close the menu.** suggestion.SPEC.md promises "Escape closes —
   Escape is left to the editor, which dismisses the menu", and the code comments assume the same,
   but returning `false` hands the event to a stack in which nobody handles Escape: the
   @tiptap/suggestion plugin has no Escape handling (verified in its source), tiptap core binds no
   Escape key, and no dashboard component listens for it around the editor. Scenario: type `@` in
   the composer, press Escape — the menu stays open; the only ways out are typing a non-matching
   character, moving the caret out of the range, or clicking elsewhere. Contradicts the SPEC.
   Severity: minor. Fix sketch: on Escape, hide the portal and deactivate the suggestion (e.g.
   set a module flag + `draw` hidden and return `true`, or dispatch a meta transaction the plugin
   reads — the standard tippy examples hide the popup and return `true`).

2. `L122`: **A trigger's exit can clobber a just-opened sibling menu's `aria-expanded`.** Each
   trigger writes the same attribute on the same editor DOM. ProseMirror updates plugin views in
   registration order (slash, tag, at, hash — the async `update` bodies resume in the same order),
   so replacing an active later trigger with an earlier one in a single transaction (e.g. `@`
   menu open, select the `@quer` text, type `/`) runs slash's `onStart` (sets `"true"`) and then
   at's `onExit` (sets `"false"`) — leaving the freshly opened `/` menu with
   `aria-expanded="false"`, so the editor's #1510 guard would send the prompt on Enter instead of
   picking, until the next keystroke redraws. Very narrow (requires swapping triggers in one
   transaction) and self-healing, but it breaks the SPEC's "the two can never disagree".
   Severity: minor, confidence low. Fix sketch: only write `"false"` from `onExit`/`draw` if this
   trigger was the one that last set it (track ownership, or re-assert in a microtask).

