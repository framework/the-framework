The entire dashboard is this one page: it reads the selection from the address, routes the main view accordingly, and owns everything the views share.

## TLDR

- The address is the selection — overview, project home, one agent, settings, tickets and ticket pages — so every view is a link to paste, reload, or bookmark.
- Owns what the views share: the agent list, project files, the cross-project needs-you queue, and the one live event stream the main view and right rail both read.
- A just-started session shows live before its record exists; with no id known yet, the page follows the output and adopts the running session once it surfaces.
- Live and finished agents are the same view — only the "live" flag flips when an agent ends.
- A shared watch link renders that one agent read-only; a daemon that stops answering gets a banner, so a dead backend never looks like a quiet agent.

## Rationales

- The selection used to be several pieces of state reconciled at render, and every disagreement was a bug; a route cannot disagree with itself.
- "No such project" and "this agent is gone" appear only after the relevant list actually loaded, so a slow read never looks like a missing thing.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
