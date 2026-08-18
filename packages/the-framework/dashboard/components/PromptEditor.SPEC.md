The rich prompt editor: `/` opens commands, `<` inserts the agent's tag macros, `@` references a project, `#` references a file — each inserted as a chip that still serializes to the exact prompt text the agent reads, so nothing downstream changes.

## TLDR

- `/` loads a preset (built-in, yours, or the project's) or inserts an agent action, and can open the create-preset panel; loading over a typed draft is allowed, one undo away, and the caller is told so its note can say so.
- Referencing a project or file also focuses the context on it, and deleting the chip undoes that focus — the prompt and the context set can never silently disagree.
- Enter sends, Shift+Enter breaks the line — except while a suggestion menu is open, inside a code block, or mid-IME-composition, where Enter keeps its editing meaning.
- Markdown is live; a compact one-line variant serves the navbar quick-launch.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
