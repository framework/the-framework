Implements the rich editing inside the composer [1]: the trigger characters that open a menu at the caret (`/` for the project's commands and the saved prompts, `@` for registered projects, `#` for files of the open project), the chips that stand for a mentioned project or file while the prompt is written, and the menu the user steers with the keyboard or the mouse. The editor that assembles these parts, defines what each trigger offers and inserts, and sends on Enter is `../PromptEditor.tsx`.

## Context

**User story**: the user writes a prompt on a project's home page or to an agent [2]. Typing `/` offers the project's commands and the saved prompts, `@` the registered projects and `#` the files of the open project; a picked project or file becomes a colored pill. What the agent finally receives is plain text with every pill spelled out exactly, so the prompt the user sees and the prompt the agent reads never differ.

## Glossary

[1] composer: the prompt editor, also used to say something to an agent.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook.

## Business logic — TL;DR

- **What a token is** (`tokens.ts`) - the two kinds of chip, a project and a file, and the guarantee that a chip is written to the prompt as its exact text.
- **Opening a menu from a trigger character** (`suggestion.ts`) - each of `/`, `@` and `#` opens its own menu at the caret when typed at the start of a word; the menu follows the caret, hides on a query that matches nothing while the trigger stays armed, shows a note over an empty source, hands a pick back to the trigger to replace the typed text, and announces itself so that Enter picks from it instead of sending.
- **Steering and picking in the menu** (`SuggestionList.tsx`) - entries grouped under headers, each with a label and a hint, the first highlighted, the arrow keys moving the highlight with wrap-around, Enter or Tab picking, and the mouse doing the same without taking the focus from the editor.
- **A token's life from keystroke to prompt** - by a pick in the `@` or the `#` menu a mention becomes a chip that is written to the prompt as its exact text.
- **Enter picks or sends** - while a trigger's menu is visible Enter picks the highlighted entry, and otherwise Enter sends the prompt.

## Business logic

### A token's life from keystroke to prompt

#### Context

See `## Context`.

#### Business logic

The user types `@` or `#` at the start of a word: the menu opens at the caret with the projects or the files that match the typed query (`suggestion.ts`, `SuggestionList.tsx`), and picking an entry replaces the trigger text with a chip for that project or file (`tokens.ts`; the per-trigger insertion is in `PromptEditor.tsx`). From then on the chip is one unit in the editor, and when the prompt leaves the editor it is written as its exact text. Nothing else makes a chip: a command or a saved prompt picked from the `/` menu loads as plain text, and text typed by hand stays text.

### Enter picks or sends

#### Context

**Problem**: Enter sends the prompt, so a menu open under the caret must be able to claim it, or Enter would send a half-typed trigger instead of picking the highlighted entry.

#### Business logic

While a trigger's menu is visible, the editor is marked as expanded and the key presses go to the menu first: Enter or Tab picks the highlighted entry (`SuggestionList.tsx`). A menu hidden after a mistyped query does not count as visible, so Enter sends again. The send itself, and the rule that Shift+Enter breaks the line, live in `PromptEditor.tsx`.
