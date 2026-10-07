Defines the tokens of the composer [1]'s prompt editor: inline chips that stand for a mention of a project (`@my-app`) or of a file (`#src/a.ts`). It holds the guarantee that a chip is written to the prompt as exactly the text it stands for, so the agent [2] receives the same prompt as if the user had typed that text.

## Context

**User story**: the user composes a prompt in the composer [1] and picks a project from the `@` menu or a file from the `#` menu. The editor shows a colored pill instead of the raw text, and the pill is selected, moved and deleted as one unit. When the prompt is sent, the agent [2] reads plain text: the project's name, the file's path.

**Problem**: what an agent receives is plain text. A chip is only how the editor shows such a string, so the display must never alter the text it stands for.

## Glossary

[1] composer: the prompt editor, also used to say something to an agent.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook.

## Business logic — TL;DR

- **Two kinds of token** - project and file; the kind decides the chip's color and which trigger menu inserts it.
- **A chip is one unit and serializes verbatim** - a chip is edited as a whole, shows its label, and is written to the prompt as its exact text with no markdown escaping.

## Business logic

### Two kinds of token

#### Context

See `## Context`.

#### Business logic

A token is a project or a file. A project chip is inserted by the editor's `@` menu and a file chip by its `#` menu (`PromptEditor.tsx`); each carries the label it shows and the text it stands for, which for both is the same string: `@` and the project's name, `#` and the file's path relative to the project. The kind is kept on the chip so the two are colored apart. Nothing else is a token: text the user types, a command, a saved prompt are plain text.

### A chip is one unit and serializes verbatim

#### Context

See `## Context`.

#### Business logic

A chip is an inline atom: it is selected, moved and deleted as one unit, never edited character by character. It displays its label, falling back to its text when the label is empty. In both the markdown that leaves the editor and its plain-text reading, a chip is written as its text, raw and unescaped, so a path with an underscore reaches the agent [2] as typed and never with a backslash in it.
