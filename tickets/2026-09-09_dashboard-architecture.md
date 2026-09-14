Priority: 9
Topics: [dashboard, skills]
GitHub: [#1768](https://github.com/framework/the-framework/issues/1768)

# Dashboard architecture

## TLDR

With the skills architecture a user cherry-picks skills (e.g. skip `skills-branch` on Claude Code Web, which manages branches itself; skip `skills-tickets`). The dashboard should show UI only for the skills that are picked. How do we structure it?

Maintainer's direction (2026-09-09): one page per skill (tickets → `/tickets`, logs → `/agents`), plus a hook for skills to add cards to the landing page. Modularity matters ~10x more than minor UX paper cuts.

The plan, its questions and the picks live in #1774 (see that ticket).

## Why it matters

Labeled highest priority. Without it the dashboard hard-codes every skill, which defeats the modular skills architecture.

## Source

Imported from GitHub issue [framework/the-framework#1768](https://github.com/framework/the-framework/issues/1768), created 2026-09-09, labels: `highest-prio 🌟`. Comments folded through 2026-09-09T23:45Z.
