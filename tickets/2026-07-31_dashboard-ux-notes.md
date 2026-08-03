Status: open
GitHub: [#1455](https://github.com/gemstack-land/the-framework/issues/1455)

# Dashboard UX notes: rail width, Docs/History placement, inline choices, composer Stop/Resume

## TLDR

Running batch of UI/UX notes from live use, worked incrementally (this thread is the de-facto design conversation for the dashboard's main view). Already done: rail narrowed to `w-[22rem]` (item 1), inline choice gates in the transcript with the rail's Choices tab retired (item 6a, PR #1482), colored kind badges (#1487), and per the thread the other quick wins outside the rail question (composer Stop/Resume among them, items 8/9). Settled since: items 2/3/6 — Docs, History and interactive transcript entries move off the right rail into the main column — **can be built**; the rail keeps conditional tabs (Files/Browser) and possibly extra info, its exact contents still open. The launcher's Tickets section (item 5, built earlier) gets **removed** again — one clear path, the tickets page. Item 6b (inline browser) design is agreed: the run emits a `browser` event, only the latest row hosts the live pane (fixed 16:10 box, ~`max-h-96`), earlier rows collapse to a one-liner, and a dead stream degrades to the last captured frame — never a dead iframe; the rail Browser tab stays for v1.

Still open: item 4 (surface all open questions across sessions in one place), item 10 (fold `handoff` into `RunMeta` so lists can show "publishing…" instead of a premature done), bonus 1 (all choices at once in one scroll area with sticky nav on the right — no pagination), bonus 2 (collapse no-longer-relevant documents to a single expandable line), and slightly colorizing row backgrounds per kind (latest note, 2026-08-03 — the colored tags landed, tinted backgrounds would make scanning "10x easier").

## Why it matters

Long-term direction settled in this thread: the main view shows the current info (choices, browser preview, …) plus a high-level overview; details live behind collapsibles or the rail. Everything here is high-impact ("we don't have to care that much about prioritization here"), giving up on nice-but-complex items is explicitly allowed, and quick-win items are open to autonomous agents.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1455](https://github.com/gemstack-land/the-framework/issues/1455), created 2026-07-31, no labels, 12 comments (last folded: 2026-08-03T08:49Z). #1456 and #1457 were closed into this issue. The OP is a per-page checklist (launcher items 1–5+11, session items 6–7, composer 8–9, status correctness 10); the TLDR above reflects the thread's current state rather than repeating it.
