---
"@gemstack/the-framework": patch
---

Fix the Overview's "Hot tickets" card misreading numeric priorities, which left it empty ("No tickets yet.") over a backlog full of urgent tickets.

The high-priority lane matched bare numbers `0`/`1` — the P0/P1 convention — while the ticket format's own scale runs 10-0 with 10 acting immediately, so a `Priority: 8` ticket never qualified. A bare number now reads on the format's scale, high from 7 up; `p0`/`p1` and the word labels (`high`, `urgent`, `critical`) still count. Closed tickets no longer surface as hot, and the card's empty state now says "Nothing in progress, queued, or high priority." instead of claiming no tickets exist.
