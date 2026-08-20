Renders the built-in system prompt's template by evaluating the small code expressions embedded in it, so one verbatim prompt text can adapt itself to each agent's settings.

## Flows

- A fragment that fails or comes out undefined (almost always a typo) stops with a loud error naming the fragment, instead of silently degrading the prompt.
- Fragments are real executable code, so only the trusted built-in prompt is ever rendered this way — never user- or repo-supplied text.
- A fragment ends at the first *adjacent* `}}`, so a nested brace must never close right against another one — a space between them is the whole fix, and without it the expression is cut short and fails on a syntax error rather than doing something subtly wrong.

## Rationales

- The adjacent-`}}` limit is a rule of this language, not a bug to fix: the language stays, and a prompt that needs two braces to close together bends around the limit on purpose — two already do.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
