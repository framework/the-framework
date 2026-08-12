The vocabulary of screen actions a model can request — screenshot, click, type, scroll, wait — copied exactly from Anthropic's native computer-use tool.

## TLDR

- The vocabulary mirrors Anthropic's schema verbatim because Claude is trained on exactly it; supporting another provider later means a new adapter, not a new vocabulary.
- Every action yields a result to show the model: a screenshot image, a one-line confirmation, or an error message.
- Cursor position is tracked in a small per-run state, because browser automation can't report where its synthetic mouse is.
- The browser page is described only by the shape the executor needs, so apps bring their own Playwright and the SDK carries no browser dependency.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
