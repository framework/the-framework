---
'@gemstack/the-framework': patch
---

The AI Queue card now reads the queue with the same rules the sweep drains it by: every markdown list item is an entry, open unless its checkbox is checked. The card's old parser only accepted `- [ ]` checkbox lines, so a queue written in the link style (`- [Title](tickets/x.md) — ...`) showed "Nothing queued." while the sweep was happily draining the very same file.
