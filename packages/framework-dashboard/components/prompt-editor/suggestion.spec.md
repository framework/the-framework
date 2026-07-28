Wires @tiptap/suggestion to the React `SuggestionList` (#470): `makeTrigger(config)` builds one editor Extension per trigger char (`/` commands, `@` references) rendering the menu into a fixed body portal at the caret.

## TLDR

- `TriggerConfig`: `char`, unique plugin `key` (own `PluginKey` per trigger so the two menus never clash), `items(query)` filter (query pre-lowercased), `onSelect(item, {editor, range})`, optional `emptyNote`.
- `makeRender` lifecycle: `onStart` creates a fixed `z-50` div on `document.body` + React root, sets `aria-expanded` on the editor DOM; `onUpdate` re-places and re-renders; `onKeyDown` forwards to the list ref (Escape falls through so the plugin closes); `onExit` tears everything down and clears aria state.
- Placement (`place`): below the caret rect, flipping above when less than 320px of viewport remains below; repositioned on capture-phase window scroll (catches the editor's own scroll container) and resize, re-reading the latest `clientRect` getter so the menu tracks the caret.
- Empty handling (#948): items empty + no query typed → show `emptyNote`; items empty *with* a query → hide the portal (`display: none`) so a stray `/`/`@` in prose isn't a trap — the plugin stays active and the menu reappears if a later key matches.
- Accessibility (#948): while open the editor carries `aria-expanded="true"` and `aria-activedescendant` pointing at the highlighted option's DOM id (set via the list's `onActiveChange`).
