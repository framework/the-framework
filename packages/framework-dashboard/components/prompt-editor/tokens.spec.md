The prompt editor's token system (#470): the TipTap inline `Token` node (an atom chip) plus the catalog of insertable macros/actions — chips read as pills but serialize back to the EXACT plain text the agent parses.

## TLDR

- `TokenSpec {kind, label, text, hint?}` with `TokenKind = macro | action | reference | project | file` (kind drives chip color and which menu inserts it).
- Catalogs: `MACRO_TOKENS` — the preset-template tags (#331/#326): `<AWAIT>`, `<REVIEW_FILE>`, `<TODO_FILE>`, `<PLAN_FILE>`, `<SESSION_NAME>`, `<FUNCTION>`; `ACTION_TOKENS` — the turn-boundary gate calls (#339/#340): `showChoices()`, `showMultiSelect()`, `showMarkdown()`.
- `TOKEN_PATTERN = /<[A-Z][A-Z0-9_]*>|show[A-Za-z]+\(\)/g` matches any insertable token in free text (used by tokenize.ts).
- `specForText`: catalogued tokens match case-insensitively and normalize to canonical form (typed `<await>` becomes `<AWAIT>`); unknown `x()` → action, unknown `<X>` → macro keeping the typed text.
- `Token` node: inline atom (edited as one unit), attrs `{kind, label, text}`; renders as `<span data-token class="pe-token">`; `renderText` and the tiptap-markdown `serialize` storage both write `text` RAW — no escaping — so `<AWAIT>` survives as `<AWAIT>`, not `\<AWAIT\>`, and the prompt over the wire is byte-identical to hand-typed text (presets, run contract, everything downstream unchanged).
- Input rules auto-chip a fully typed token when the closing `>` or `)` lands.

## Facts

- The input-rule regexes deliberately have NO capture groups: `nodeInputRule` replaces only a captured sub-match when one exists, which would leave the surrounding `<`/`>` behind.
