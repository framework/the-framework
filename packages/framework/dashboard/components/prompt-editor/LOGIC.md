Implements the rich editing inside the composer [1]: the trigger characters that open a menu at the caret (`/` for presets and agent [2] actions, `<` for macro tags, `@` for registered projects, `#` for files of the open project), the chips that stand for a macro tag, an action call or a mention while the prompt is written, the rule that turns a loaded preset's tags into chips, and the menu the user steers with the keyboard or the mouse. The editor that assembles these parts, defines what each trigger offers and inserts, sends on Enter and keeps the agent's context in step with the `@` and `#` chips is `PromptEditor.tsx`, one level up, hosted by `Composer.tsx` on the project home and in live chat.

## Context

**User story**: the user writes a prompt on a project's home page or to a running agent [2]. Typing `/` offers the presets and the actions an agent can be told to use, `<` the macro tags the preset prompts repeat, `@` the registered projects and `#` the files of the open project; every insertion becomes a colored pill, and so does a tag or call the user types out by hand. What the agent finally receives is plain text with every pill spelled out exactly as the agent expects it, so the prompt the user sees and the prompt the agent reads never differ.

## Glossary

[1] composer: the prompt editor, also used for live chat.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **What a token is** (`tokens.ts`) - the catalog of six macro tags and three action calls with their menu hints, the five kinds of chip, how a token string is recognized in text and normalized to its catalogued spelling, how a fully typed tag or call turns into a chip on its own, and the guarantee that a chip is written to the prompt as its exact text.
- **Chipping a loaded prompt** (`tokenize.ts`) - every tag or call in freshly loaded text becomes a chip at once, except inside an inline code span.
- **Opening a menu from a trigger character** (`suggestion.ts`) - each of `/`, `<`, `@` and `#` opens its own menu at the caret when typed at the start of a word; the menu follows the caret, hides on a query that matches nothing while the trigger stays armed, shows a note over an empty source, hands a pick back to the trigger to replace the typed text, and announces itself so that Enter picks from it instead of sending.
- **Steering and picking in the menu** (`SuggestionList.tsx`) - entries grouped under headers, each with a label and a hint, the first highlighted, the arrow keys moving the highlight with wrap-around, Enter or Tab picking, and the mouse doing the same without taking the focus from the editor.

## Business logic

### A token's life from keystroke to prompt

#### Context

See `## Context`.

#### Business logic

A token reaches the prompt by one of three roads, and ends the same way on all of them. First, the user types a trigger character at the start of a word: its menu opens at the caret with the entries the trigger offers for the typed query (`suggestion.ts`, `SuggestionList.tsx`), and picking an entry replaces the trigger text with a chip built from the catalog or from the picked project or file (`tokens.ts`; the per-trigger insertion is in `PromptEditor.tsx`). Second, the user types a tag or call out in full: the moment its closing `>` or `)` lands, the typed string becomes a chip, normalized to the catalogued spelling when it matches one (`tokens.ts`). Third, a preset is loaded: its text is set into the editor and every tag or call in it, outside inline code, becomes a chip at once (`tokenize.ts`). Whatever the road, a chip shows its label, is edited as one unit, and is written to the outgoing prompt as its exact text with no escaping, so the agent [2] receives `<AWAIT>` or `showChoices()` spelled as the catalog spells them.

### Enter picks or sends

#### Context

**Problem**: Enter sends the prompt, so a menu open under the caret must be able to claim it, or Enter would send a half-typed trigger instead of picking the highlighted entry.

#### Business logic

While a trigger's menu is visible, the editor is marked as expanded and the key presses go to the menu first: Enter or Tab picks the highlighted entry (`SuggestionList.tsx`). A menu hidden after a mistyped query does not count as visible, so Enter sends again. The send itself, and the rule that Shift+Enter breaks the line, live in `PromptEditor.tsx`.
