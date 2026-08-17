Priority: 5
GitHub: [#1501](https://github.com/gemstack-land/the-framework/issues/1501)

# Remove prompt to import GH issues

## TLDR

Remove the dedicated "import GH issues" prompt in favor of the `update_tickets` preset prompt (`packages/the-framework/prompts/presets/update_tickets.md` in gemstack-land/gemstack), which also covers the case where `tickets/` is empty (first import).

## Why it matters

Two prompts for one job drift apart; the update prompt already subsumes the import case.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1501](https://github.com/gemstack-land/the-framework/issues/1501), created 2026-08-04, no labels, 0 comments.
