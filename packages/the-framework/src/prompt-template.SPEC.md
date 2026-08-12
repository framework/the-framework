Renders the built-in system prompt's template by evaluating the small code expressions embedded in it, so one verbatim prompt text can adapt itself to each run's settings.

## TLDR

- A fragment that fails or comes out undefined (almost always a typo) stops with a loud error naming the fragment, instead of silently degrading the prompt.
- Fragments are real executable code, so only the trusted built-in prompt is ever rendered this way — never user- or repo-supplied text.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
