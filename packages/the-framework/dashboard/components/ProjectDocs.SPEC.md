The "Docs" section on the project home: the project's PLAN and TODO documents, rendered in the main column where the user starts an agent.

## Business logic — TL;DR

- **Earned by content** - a project whose checkout holds no such document gets no Docs section at all, rather than an empty box; the section also stays hidden while the first read is still out, so it never flickers.
- **Kept current** - the documents are re-read every few seconds, so edits an agent makes to a PLAN or TODO show up without the user reloading the page.
- **Bounded height** - a long document scrolls inside the section instead of pushing the rest of the project home off the screen.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
