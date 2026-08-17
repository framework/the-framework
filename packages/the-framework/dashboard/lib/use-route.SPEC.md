The address bar as the dashboard's selection: read which view, project, and agent the live URL names, and navigate by naming another — so Back/Forward work and an agent is a link you can paste, reload, and bookmark.

## TLDR

- Going where you already are adds no history entry, and a correction (adopting a just-started agent's real id) replaces the current entry rather than adding a step you could go Back to.
- It reads the browser's live address, not what was baked in at build time — the shell is one static page served for every path, so only the address bar tells the truth.
- It is the History API and a subscription, nothing more. A client router used to own this; its whole contribution was exposing the pathname and pushing to it, alongside a catch-all route whose return value was deliberately never read.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
