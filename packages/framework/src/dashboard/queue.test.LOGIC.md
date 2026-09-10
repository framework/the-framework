What the tests cover:

- **What counts as a queue entry** - a list item with an unchecked checkbox is an open entry and one with a checked checkbox, upper or lower case and at any indentation, is a done entry, with the checkbox stripped from the text; a line that is not a list item is not an entry; a checkbox item with no text is dropped.
- **Entries without a checkbox** - a triage-written entry in the ticket-link style, a starred item and a numbered item are open entries; a continuation line indented under an entry, a heading and prose are not entries; the open entries agree exactly with the `queue` skill's own parser, which is what the daemon drains by.
- **One block per project, most open first** - the `TODO` documents of each project are matched by file name wherever they sit, open and total entries are counted per project, a project with no `TODO` document or with a `TODO` document holding no entries is left out, and the blocks are ordered by open entries descending.
- **A project that cannot be read** - is skipped while the others are still rolled up.
