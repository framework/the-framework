Defines the tokens of the composer [1]'s prompt editor: inline chips that stand for a macro tag such as `<AWAIT>`, an agent [2] action call such as `showMultiSelect()`, or a mention of a project or file. It holds the catalog of known macros and actions, the rule for recognizing a token in plain text, and the guarantee that a chip is written to the prompt as exactly the text it stands for, so the agent receives the same prompt as if the user had typed that text.

## Context

**User story**: the user composes a prompt in the composer [1]. Where a preset's prompt contains `<AWAIT>` or `showChoices()`, or where the user types one, the editor shows a colored pill instead of the raw text, and the pill is selected, moved and deleted as one unit. When the prompt is sent, the agent [2] reads plain text with the token's exact spelling.

**Problem**: what an agent receives is plain text, and the macro tags and action calls in it mean something to the agent only in their exact spelling. A chip is only how the editor shows such a string, so the display must never alter the text it stands for.

## Glossary

[1] composer: the prompt editor, also used for live chat.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[4] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[5] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.

## Business logic — TL;DR

- **Five kinds of token** - macro, action, reference, project and file; the kind decides the chip's color and which trigger menu inserts it.
- **The macro catalog** - the six angle-bracket tags the preset prompts repeat, each with a one-line hint for the menu.
- **The action catalog** - the three call-shaped tokens that make the agent stop at a gate [3] or push a view [4], each with a hint.
- **Recognizing a token in text** - an upper-case angle-bracket tag or a `show…()` call anywhere in free text is a token; this is how a loaded preset is turned into chips.
- **Normalizing a known token** - a token matching a catalogued one in any letter case becomes that catalogued token; an unknown one keeps its exact spelling.
- **A chip is one unit and serializes verbatim** - a chip is edited as a whole, shows its label, and is written to the prompt as its exact text with no markdown escaping.
- **Chips form while typing** - a tag becomes a chip the moment its closing `>` is typed, a call the moment its closing `)` is typed.

## Business logic

### Five kinds of token

#### Context

See `## Context`.

#### Business logic

A token is of one of five kinds: `macro` (an angle-bracket tag), `action` (a call such as `showChoices()`), `reference` (a general mention), `project` (an `@` mention of a registered project) and `file` (a `#` mention of a file of the open project). Every token carries a label, which is what its chip shows, and a text, which is the exact string written to the prompt; a catalogued token also carries a hint, the one-line description its menu entry shows. The kind is stamped on the chip and picks its color. Which trigger menu inserts which kind is decided by the trigger definitions in `PromptEditor.tsx`.

### The macro catalog

#### Context

**Business logic story**: the preset prompts define and repeat a handful of tags, so the editor offers them from a menu instead of expecting the user to remember their spelling.

#### Business logic

Six macros are catalogued, each shown in the menu with its hint: `<AWAIT>` "Stop and wait for the user", `<REVIEW_FILE>` "The review scratch file", `<TODO_FILE>` "The session TODO file", `<PLAN_FILE>` "The session plan file", `<SESSION_NAME>` "The sanitized branch slug" (the session name [5]), and `<FUNCTION>` "A function placeholder". A macro chip reads as the tag's name without its angle brackets ("AWAIT") and is written to the prompt with them (`<AWAIT>`).

### The action catalog

#### Context

**Business logic story**: an agent [2] stops at a gate [3] or pushes a view [4] by writing a call-shaped signal in its turn's final message; a prompt that names such a call tells the agent to use it.

#### Business logic

Three actions are catalogued: `showChoices()` "Single-select gate", `showMultiSelect()` "Multi-select gate" and `showMarkdown()` "Push a markdown view". An action chip reads exactly as its call and is written to the prompt as that call.

### Recognizing a token in text

#### Context

**User story**: the user loads a preset whose prompt is plain text; the tags and calls in it must appear as chips without the user retyping them.

#### Business logic

Anywhere in free text, a token is either a tag written as `<`, an upper-case letter, any run of upper-case letters, digits and underscores, and `>`, or a call written as `show`, one or more letters, and `()`. A lower-case tag in loaded text is not a token. Turning loaded text into chips is done by `tokenize.ts` with this rule.

### Normalizing a known token

#### Context

**Problem**: a macro means something to the agent [2] only in its canonical spelling; a user who types `<await>` means `<AWAIT>`, and a chip that kept the lower-case spelling would silently send a tag the agent does not act on.

#### Business logic

A recognized string is compared with the catalogued macros and actions ignoring letter case; on a match, the chip takes the catalogued token, so both its label and its text are the canonical spelling. A string that matches nothing keeps its exact spelling: one ending in `()` becomes an action whose label is the call itself, and any other becomes a macro whose label is the string without its surrounding `<` and `>`.

### A chip is one unit and serializes verbatim

#### Context

See `## Context`.

#### Business logic

A chip is an inline atom: it is selected, moved and deleted as one unit, never edited character by character. It displays its label, falling back to its text when the label is empty. In both the markdown that leaves the editor and its plain-text reading, a chip is written as its text, raw and unescaped, so `<AWAIT>` reaches the agent [2] as `<AWAIT>` and never as `\<AWAIT\>`.

### Chips form while typing

#### Context

**User story**: the user types `<AWAIT>` or `showChoices()` by hand and sees it turn into a chip as soon as the token is complete, without opening a menu.

#### Business logic

As the user types, a tag of the form `<`, a letter, any run of letters, digits and underscores, and `>` becomes a chip the moment the closing `>` is typed, whatever its letter case; a call of the form `show`, letters, `()` becomes a chip the moment the closing `)` is typed. The whole typed string is replaced, so no bracket is left behind. The new chip is normalized like any recognized token: a typed `<await>` becomes the `<AWAIT>` chip, while an unknown tag keeps its spelling and is still written to the prompt exactly as typed.
