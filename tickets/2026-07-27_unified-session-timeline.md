Topics: [enhancement, ux]
GitHub: [#1266](https://github.com/gemstack-land/the-framework/issues/1266)

# Unified session timeline: one interactive row design for both local and web runs

## TLDR

Umbrella, from live-testing choices in both modes: local and web sessions answer questions through different transports (choice gate + sendChoice vs the extension bridge), and each grew its own UI — the right-rail "Your call" panel locally, a pick-then-send block for web. Same capability, unrelated looks. Direction: the session view is ONE timeline of typed rows, interactive in place identically in both modes — question rows render choices inline as real radios/checkboxes + an Answer button (one component; only the submit path differs, with a "via claude.ai" chip and open-session fallback; the right-rail Choices tab stays as a shortcut bound to the same state), browser rows embed the live browser pane at that point, the CC-web mirror is one live boxed row at the hand-off point (#1265), and row-kind colors make QUESTION / BROWSER / CLOUD scan at a glance.

## Why it matters

Every new row kind multiplies the inconsistency between the two modes unless there's one row design. Children: #1263 (sidebar agent logo + cloud badge) and #1264 (honest "In cloud" status) — both already closed — plus #1265. Post-demo work except #1263/#1264.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1266](https://github.com/gemstack-land/the-framework/issues/1266), created 2026-07-27, labels: `enhancement`, `UX ✨`.

### Original description

Umbrella, from live-testing choices in both modes. Local and web sessions answer questions through different transports (choice gate + sendChoice vs the extension bridge), and each grew its own UI: the right-rail "Your call" panel locally, a pick-then-send block for web. Same capability, unrelated looks.

Direction: the session view is ONE timeline of typed rows, and interactive things are interactive in the timeline, identically in both modes:

- (Question) rows: choices render inline in the log as real radios/checkboxes + an Answer button, one component for both modes; only the submit path differs (sendChoice vs bridge fill-and-send, with a "via claude.ai" chip and the open-session fallback). The right-rail Choices tab stays as a shortcut bound to the same state.
- (Browser) rows: a run driving a browser embeds its live pane as a row at that point in the timeline.
- (CC web) row: the bridge mirror as one live boxed row at the hand-off point (#1265).
- Row-kind colors so QUESTION / BROWSER / CLOUD scan at a glance.

Children: #1263 (sidebar agent logo + cloud badge), #1264 (honest "In cloud" status), #1265 (mirror as a live log row). Post-demo work except #1263/#1264.
