The catalogue of what the prompt editor can turn into a chip — the macro tags and the agent actions — and the rule that a chip is never anything more than a nicer view of exact prompt text.

## Glossary

- **chip** - an inserted reference or tag shown as one inline pill in the prompt editor, selected and deleted as a single unit rather than character by character.
- **macro tag** - one of the framework's repeated prompt tags, all written `<NAME>`.
- **agent action** - a call the prompt can ask the agent to make.

## Business logic — TL;DR

- **A chip is only a display** - whatever the editor shows, the prompt sent to the agent contains the token's exact text, written raw with no markdown escaping. Presets, the agent's own contract and everything else downstream are untouched by chips existing.
- **The macro tags** - `<AWAIT>` (stop and wait for the user), `<REVIEW_FILE>` (the review scratch file), `<TODO_FILE>` (the agent's TODO file), `<PLAN_FILE>` (the agent's plan file), `<SESSION_NAME>` (the session name, sanitized for the branch), and `<FUNCTION>` (a function placeholder). Each shows a one-line explanation in the menu.
- **The agent actions** - `showChoices()` (open a single-select gate), `showMultiSelect()` (open a multi-select gate), and `showMarkdown()` (push a markdown view to the user).
- **Typing one is the same as picking one** - a token typed by hand becomes a chip the moment it is finished: a macro tag when its closing `>` lands, an agent action when its closing `)` lands.
- **Catalogued tokens are normalized** - a macro tag or agent action from the catalogue is recognised whatever the typed casing and rewritten to its canonical spelling, so a typed `<await>` reaches the agent as the `<AWAIT>` it expects. A token that is not in the catalogue is kept exactly as typed.
- **Each kind looks different** - macro tags, agent actions, project references and file references are visually distinct, so a glance at the prompt says what kind of thing each chip is.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
