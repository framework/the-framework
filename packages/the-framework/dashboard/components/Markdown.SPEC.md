A tiny, dependency-free Markdown renderer for agent-written content: the surfaced PLAN/TODO docs, pushed views, and conversation messages.

## Flows

- It builds display elements directly and never injects raw HTML, and links render only for web addresses — so agent-written text can never smuggle markup or scripts into the page.
- It covers what that content actually uses (headings, bullet and task lists, code, bold/italic, links, pipe tables); anything else falls through as a plain paragraph, so nothing is ever dropped.
- Compact mode shrinks everything a notch so a reply reads at the event log's density rather than as a full document.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
