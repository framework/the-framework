The floating command/reference menu (#470) opened by the editor's `/` and `@` triggers: a plain keyboard-navigable list rendered into the portal `suggestion.ts` positions.

## TLDR

- Driven imperatively by @tiptap/suggestion: exposes `onKeyDown` via ref (ArrowUp/Down cycle with wraparound, Enter/Tab pick); mouse uses `onMouseDown` + preventDefault so the editor keeps focus.
- Reads as a listbox to assistive tech (#948): `role="listbox"` / `role="option"` rows with stable DOM ids (`prompt-suggestion-option-<i>`), mirrored out via `onActiveChange` for the editor's `aria-activedescendant` — focus never leaves the contenteditable.
- `SuggestionItem`: `label` + `hint`, optional `group` (consecutive same-group items share one section header), optional `title` hover text for items whose output destination isn't obvious (#698).
- `emptyNote` renders a status box on a fresh empty-source trigger (projects/files not loaded or none exist) — otherwise the feature looks broken; a mistyped query instead closes the menu (suggestion.ts hides the portal).
- Highlight resets to 0 whenever the filtered items change so it never points past the end.
