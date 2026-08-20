The address bar as the dashboard's selection: read which view, project, and agent the live URL names, and navigate by naming another — so Back/Forward work and an agent is a link you can paste, reload, and bookmark.

## Flows

- Going where you already are adds no history entry, and a correction (adopting a just-started agent's real id) replaces the current entry rather than adding a step you could go Back to.
- It reads the browser's live address, not what was baked in at build time — the shell is one static page served for every path, so only the address bar tells the truth.

## Rationales

- No client router library is involved: the whole routing need is reading the current path and navigating to another, which the browser's own history does directly.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
