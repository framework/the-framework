The entire dashboard is this one page: it reads the selection from the address, routes the main view accordingly, and owns everything the views share.

## Flows

- The address is the selection — overview, project home, one agent, settings, tickets and ticket pages — so every view is a link to paste, reload, or bookmark.
- The page owns what the views share: the agent list, the project list (each project carrying what the daemon currently finds wrong with it), project files, the cross-project needs-you queue, and the one live event stream the main view and right rail both read.
- A just-started session shows live before its record exists; with no id known yet, the page follows the output and adopts the running session once it surfaces.
- Live and finished agents are the same view — only the "live" flag flips when an agent ends.
- A daemon that stops answering gets a banner, so a dead backend never looks like a quiet agent.

## Rationales

- The address is the only selection state because a route cannot disagree with itself — selection kept as several pieces of state reconciled at render can disagree, and every disagreement is a bug.
- "No such project" and "this agent is gone" appear only after the relevant list actually loaded, so a slow read never looks like a missing thing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
