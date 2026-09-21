Priority: 9
Issue: [#1768](https://github.com/framework/the-framework/issues/1768)

# Dashboard architecture

## TLDR

With the skills architecture a user picks the skills they want: skip `branches` because Claude Code Web already manages branches, or skip `tickets` if they don't want that feature. The dashboard should show UI only for the skills that are picked. How is it structured? The maintainer's direction: one page per skill (`/tickets` for tickets, `/agents` for the logs) and a hook for skills to add cards to the landing page. Modularity is "10x more important than minor UX paper cuts". The plan and its six questions live in #1774 (its own ticket).

## Why it matters

Labeled highest priority. Without it, skills are modular in the repository but not in the UI: the dashboard keeps showing pages for skills a project dropped, and cannot show a replacement skill.

## Source

Imported from GitHub issue [framework/the-framework#1768](https://github.com/framework/the-framework/issues/1768), created 2026-09-09, labels: `highest-prio 🌟`, 2 comments (last folded: 2026-09-09T23:45Z).
