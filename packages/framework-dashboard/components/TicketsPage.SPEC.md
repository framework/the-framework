The cross-project Tickets view: every registered project's backlog on one full-width page — filterable, sortable, groupable — because the backlog is worth seeing whole rather than scoped to whichever project happens to be selected.

## TLDR

- The whole viewing state lives in the URL, so a filtered view is a link you can share and reload; changes mirror to the address without adding history steps, and the shown/total tally rides the page title.
- Grouped by project by default, each section its own panel with its GitHub update bar; the flat list is the one view that can answer "what is the single highest-priority ticket anywhere", its rows carrying their project and still starting work or plans in it.
- Click-to-filter from the rows themselves: a topic badge adds its topic (additively, widening the OR), the claim marker narrows to claimed tickets.
- A project deselected in the Project facet disappears entirely — no "N hidden" noise about a choice made on purpose — while filtered-to-nothing states say so and clear from right there.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
