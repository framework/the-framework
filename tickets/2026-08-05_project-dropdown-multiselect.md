Priority: 3
Topics: [UX, only-if-quick-win]
Issue: [#1513](https://github.com/gemstack-land/the-framework/issues/1513)

# Project dropdown

## TLDR

Make the project select at the top of the sidebar a multi-select. A first cut is in PR #1923: the select sits at the top of the sidebar (right below the "The Framework" logo/text), set apart by a rule, and filters every page (tickets, overview, recent sessions, ...), but it picks only one project or "All". What is left: selecting several projects at once. Dropdown behavior: a checkbox per project; selected projects shown on top; the "All" value; checkbox click toggles a project; clicking the row outside the checkbox selects only that project; tooltips clarify usage.

## Why it matters

Project scoping is the top-level filter for the whole dashboard; with a single pick there is no view across a few chosen projects.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1513](https://github.com/gemstack-land/the-framework/issues/1513), created 2026-08-05, labels: `UX ✨`, `only-if-quick-win 🧹`, 1 comment. The first cut (PR #1923) was built so the multi-select can be added on top without redoing it; the issue stays open for the multi-select. Visual treatment of the top section is open for brainstorming.
