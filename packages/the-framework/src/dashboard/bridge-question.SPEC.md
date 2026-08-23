The shape of a question a cloud session is parked on, as the Claude web bridge reports it, and its projection onto the dashboard's gate panel — so a question asked on claude.ai is rendered and answered exactly like a question a local agent parked on.

## Business logic — TL;DR

- **A bridged question carries the whole question** - which cloud session asked, the title, the options, which option is recommended, whether several answers may be picked at once, and when the daemon accepted it. Each option carries its label, an optional one-line detail, whether it starts checked on a multi-select question, and whether picking it means "stop, I will take it from here".
- **Labels stand in for option ids** - a claude.ai page has no option ids, and the label is the only thing the extension can type back, so the projected choice uses each option's label as its id.
- **The join back to an agent is the cloud session id** - the question names the cloud session, which is what matches it to the `web`-target agent that handed its task there.
- **One projection, used on both sides** - the dashboard renders a bridged question through the same choice panel as a local gate, so the projection is deliberately free of anything only the daemon could run and the browser performs it itself.
- **The moment it was accepted is the daemon's to stamp** - never the caller's.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
