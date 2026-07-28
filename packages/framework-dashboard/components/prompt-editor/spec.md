The TipTap prompt-editor internals (#470) behind `PromptEditor.tsx`: token chips that serialize to exact agent-parseable text, and the `/`/`@` suggestion menus.

## TLDR

- `tokens.ts` — the inline `Token` atom node + macro/action catalogs + `TOKEN_PATTERN`/`specForText`; chips flatten verbatim so the wire prompt is unchanged.
- `tokenize.ts` — one-transaction chip-ification of plain token strings already in the doc (preset loads), back-to-front, skipping inline code.
- `suggestion.ts` — `makeTrigger(config)`: wires @tiptap/suggestion to a fixed caret-tracking portal per trigger char, with aria combobox wiring and empty-source notes (#948).
- `SuggestionList.tsx` — the rendered listbox: arrow/Enter/Tab keyboard handling via ref, grouped rows, `aria-activedescendant` ids.

## Facts

- Core invariant across the directory: what the editor shows (chips, pills) never changes what is submitted — serialization is the exact text the agent already parses today.
