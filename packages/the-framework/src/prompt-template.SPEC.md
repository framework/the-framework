Renders the built-in system prompt's template by evaluating the small code expressions embedded in it, so one verbatim prompt text can adapt itself to each agent's settings.

## TLDR

- A fragment that fails or comes out undefined (almost always a typo) stops with a loud error naming the fragment, instead of silently degrading the prompt.
- Fragments are real executable code, so only the trusted built-in prompt is ever rendered this way — never user- or repo-supplied text.
- A fragment ends at the first *adjacent* `}}`, so a nested brace must never close right against another one — a space between them is the whole fix, and without it the expression is cut short and fails on a syntax error rather than doing something subtly wrong. A rule of this language rather than a bug: replacing the language was considered and declined, and two prompts already work around it.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
