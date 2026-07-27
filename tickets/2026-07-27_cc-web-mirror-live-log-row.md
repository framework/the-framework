Status: open
Topics: [enhancement, ux]
GitHub: [#1265](https://github.com/gemstack-land/the-framework/issues/1265)

# Render the CC-web mirror as a live row inside the session log

## TLDR

The bridge mirror currently renders as its own pane above the log while the log dead-ends at "Handed off: the rest of this run happens in its own session". Instead: pin ONE live boxed row at the tail of the log, at the hand-off point — mirror content streams into it as the extension delivers, with a "connecting to the cloud session..." placeholder so a web run never shows dead air. Deliberately NOT merged as ordinary log rows: `events.jsonl` is durable provenance-clean data, the mirror is a best-effort tab scrape — one clearly-labeled live box keeps that boundary. Include a scrape filter: the tail currently drags in claude.ai UI chrome ("Arrow keys move the tile...", model name, "Show message actions").

## Why it matters

A web run that shows dead air after hand-off looks broken; the live row keeps the session log the single place to watch without polluting durable run data with scraped content. Child of #1266 (unified session timeline); post-demo work.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1265](https://github.com/gemstack-land/the-framework/issues/1265), created 2026-07-27, labels: `enhancement`, `UX ✨`.

### Original description

Today the bridge mirror renders as its own pane above the log, and the log dead-ends at "Handed off: the rest of this run happens in its own session". Instead, pin ONE live boxed row at the tail of the log, at the hand-off point: the mirror content streams into it as the extension delivers, with a "connecting to the cloud session..." placeholder so a web run never shows dead air.

Deliberately not merged as ordinary log rows: events.jsonl is durable provenance-clean data, the mirror is a best-effort tab scrape. One clearly-labeled live box keeps that boundary.

Include a scrape filter: the tail currently drags in claude.ai UI chrome ("Arrow keys move the tile...", model name, "Show message actions").
