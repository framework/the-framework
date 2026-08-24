# Bug analysis: packages/framework/dashboard/components/prompt-editor/SuggestionList.tsx

## Business logic (high-level)

The floating menu every typed trigger (`/`, `<`, `@`, `#`) opens. It is a dumb, imperatively driven
list: `@tiptap/suggestion` (via suggestion.ts) owns detection and positioning; this component owns
highlight state, keyboard handling (forwarded through the `SuggestionListRef`), mouse handling, the
group headers, and the a11y wiring (options carry DOM ids that the editor's
`aria-activedescendant` points at, since focus never leaves the contenteditable).

Invariants promised by SuggestionList.SPEC.md and checked against the code:

- Arrow keys wrap at both ends — modulo arithmetic on lines 56/60 does this correctly, including
  the negative-wrap `(i - 1 + items.length) % items.length`.
- Enter/Tab pick the highlighted entry; every other key returns `false` so the editor keeps
  filtering. Correct.
- Hover highlights (`onMouseEnter` → `setSelected(i)`), mousedown picks with `preventDefault()` so
  the editor keeps the caret. Correct.
- Consecutive items of one group share a heading: `item.group && (i === 0 || items[i-1]?.group !==
  item.group)` — correct, including a group change mid-list and a group at index 0.
- Empty-source note: rendered when `items.length === 0`, with the caller (suggestion.ts) taking
  care that this render is only *visible* on a fresh trigger with an `emptyNote`; a mistyped query
  hides the whole portal. The `role="status"` div and the `emptyNote ?? 'No matches'` fallback are
  consistent with that contract ('No matches' is effectively dead text — only visible if a caller
  ever showed the empty state without a note, which suggestion.ts never does).
- Highlight-never-dangles: `useEffect(() => setSelected(0), [items])` resets on every new `items`
  array identity. Since suggestion.ts builds a fresh array per update, the reset fires on each
  filter change as the SPEC asks. It also fires on caret moves that do not change the query (same
  content, new identity) — a harmless, slightly stronger reset than the SPEC's wording.

Ordering concern examined: between a render with a shorter `items` and the `useEffect` reset
committing, `selected` can briefly exceed `items.length - 1`. `ArrowDown`/`ArrowUp` still stay in
range via the modulo; `Enter`/`Tab` guard with `if (item) command(item)` and merely swallow the
keypress. No crash, no wrong pick; at worst one dead Enter in a microscopic window.

## Functions (low-level)

- `optionDomId(index)` — builds `prompt-suggestion-option-<i>`. Unique because only one menu is
  visible at a time (suggestion.ts hides/exits the others). Verdict: correct.
- `SuggestionList` (forwardRef component)
  - `selected` state + reset effect: see above. Verdict: correct.
  - Mirror effect `onActiveChange?.(items.length > 0 ? optionDomId(selected) : null)`: fires on
    items/selected change; suggestion.ts writes it to `aria-activedescendant`. When the list
    empties, `null` clears the attribute. Verdict: correct.
  - `useImperativeHandle` `onKeyDown`: returns `false` when `items.length === 0`, so keys pass
    through to the editor while the (hidden or note-showing) menu has nothing to pick — Enter
    with the empty note visible therefore sends the prompt; consistent with the editor's guard
    reading `aria-expanded` (suggestion.ts leaves it `'true'` for the note)? — no: with the note
    visible aria-expanded is `'true'`, so the editor's Enter guard returns false and PM's default
    Enter inserts a paragraph instead of sending. Debatable UX, but the menu showing "No projects
    to reference yet." while Enter does not send is defensible (the user is mid-trigger); not
    contrary to any spec sentence. Noted, not reported.
  - Render: buttons with `type="button"`, `aria-selected`, optional `title`. `onMouseDown`
    prevents default → editor keeps focus, then `command(item)`. Verdict: correct.

## Bugs found

None found. (One timing curiosity — a stale `selected` for one commit after the list shrinks —
is provably harmless; see above.)
