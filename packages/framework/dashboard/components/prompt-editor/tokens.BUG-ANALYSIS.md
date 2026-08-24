# Bug analysis: packages/framework/dashboard/components/prompt-editor/tokens.ts

## Business logic (high-level)

The token catalogue (macros + agent actions) and the Tiptap `Token` node that implements the chip
guarantee: a chip renders as a pill (`label`) but serializes to its exact `text`, raw, with no
markdown escaping, so the prompt over the wire is unchanged by chips existing.

Checked against tokens.SPEC.md:

- Catalogue contents (six macros, three actions, each with a hint) match the SPEC's lists exactly.
- "Typing one is the same as picking one": input rules fire on the closing `>` / `)` and go
  through `specForText`, which normalizes catalogued tokens case-insensitively — a typed `<await>`
  becomes `<AWAIT>` as promised. Uncatalogued tokens keep what was typed.
- Serialization: `renderText` and the `markdown.serialize` storage both write `node.attrs.text`
  verbatim (`state.write`, not `state.text`), so `<AWAIT>` is not escaped to `\<AWAIT\>`. Correct.
- Round-tripping through HTML (copy/paste inside the editor): `renderHTML` merges
  `HTMLAttributes`, which tiptap fills with the auto-rendered `kind`/`label`/`text` attributes,
  and `parseHTML`'s `span[data-token]` restores them via tiptap's default per-attribute
  `getAttribute` parsing. A *foreign* `<span data-token>` pasted from elsewhere would produce an
  empty token (default attrs), but nothing produces one. Noted, not reported.
- Input-rule regexes deliberately have no capture groups (a captured sub-match would leave the
  brackets behind) — the comment is accurate for `nodeInputRule`.
- Input rules do not fire inside code (prosemirror-inputrules skips `code` parents), which is what
  lets a code-block example keep its literal tokens — and what makes tokenize.ts's missing
  code-block guard reachable (reported in tokenize's analysis, not here).

## Functions (low-level)

- `MACRO_TOKENS` / `ACTION_TOKENS` — data; consistent with SPEC. Correct.
- `TOKEN_PATTERN` — `/<[A-Z][A-Z0-9_]*>|show[A-Za-z]+\(\)/g`. Uppercase-only macro start, while
  the typing-side input rule accepts `/<[A-Za-z][A-Za-z0-9_]*>$/`. Consequence: a *loaded* preset
  containing a lowercase-spelled catalogued macro (`<await>`) is neither chipified nor normalized,
  although typing the same characters is. The directory SPEC's bullet ("Typed and loaded text
  becomes chips too … Catalogued tokens are normalized to their canonical spelling on the way
  in") reads as covering the loaded path as well. The uppercase restriction is plausibly a
  deliberate conservatism (avoid chipifying `<div>`-ish prose in loaded text), but then loaded
  lowercase catalogue tokens silently reach the agent unrecognized. Suspicious-but-unproven
  intent mismatch — reported as low confidence (bug 1).
- `specForText(text)` — case-insensitive catalogue lookup, `()`-suffix → action, else macro with
  brackets stripped for the label. Edge: called only with strings matching one of the two regex
  shapes, so `text.replace(/^<|>$/g, '')` is safe. Correct.
- `Token` node — inline atom, selectable; attrs kind/label/text with defaults.
  - `renderHTML` — pill markup, label falls back to text. Correct.
  - `renderText` — mirrors markdown serialization. Correct.
  - `addInputRules` — see above. Correct.
  - `addStorage().markdown` — `serialize` writes raw text; `parse: {}` leaves parsing to
    tokenize.ts. Correct.

## Bugs found

1. `L41`: **Loaded lowercase catalogue tokens are not converted/normalized, unlike typed ones.**
   Scenario: a project preset (arbitrary repo markdown) or hand-edited saved preset contains
   `<await>`; loading it leaves plain text — no chip, no normalization to `<AWAIT>` — so the agent
   receives a tag it does not recognize, while typing the identical characters in the editor
   produces the canonical `<AWAIT>`. Contradicts the prompt-editor SPEC's "loaded text becomes
   chips too … catalogued tokens are normalized … on the way in" reading; may however be a
   deliberate trade-off to keep `<div>`-like prose in loaded text un-chipped. Severity: minor,
   confidence: low. Fix sketch: extend `TOKEN_PATTERN` to `[A-Za-z]` start (specForText already
   normalizes catalogued matches and preserves unknown ones verbatim, so the chip guarantee holds
   either way) — or amend the SPEC to scope normalization to typing.

