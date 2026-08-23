What the tests cover, grouped by the behaviour they pin.

**The conversation** — a prompt is marked as the user's turn and a reply as the agent's; a prompt shows its own text; a reply is rendered as markdown rather than raw markup; a long message clamps to its first line and offers to expand while a short one shows in full with no such control; and content pinned after the last row lives inside the scrolling area, after the rows, rather than floating over them.

**Colour meaning** — the driver erroring, an error the agent reported about itself, and an agent settling badly all read red; an agent the user stopped and an agent that finished cleanly do not; the user's own turn reads blue. The kind badge is separately tinted for scanning — a gate amber, a clean finish green, a pushed view in the accent colour — without recolouring the row's text, and a failed finish keeps its red badge, so meaning beats the per-kind tint. The background wash is applied to exactly the user's turns, failures, and a clean finish; a stopped agent and an ordinary agent reply stay plain.

**Prompt placement** — the user's first prompt is hoisted above the session and system-prompt rows that precede it; a later prompt stays where it happened; a log containing no prompt at all is left in its original order.

**Gates in the flow** — with the transcript's project known, an open gate is answerable in place and the pick is posted against the right agent; without the project, the row stays plain text. An answered gate collapses to a line stating the question, hides the separate line that reported the resolution, is no longer answerable, and expands to show what was picked. A gate the agent ended without answering stays plain text, and a gate that fired twice is answerable only at its latest firing.

**The browser preview in the flow** — the latest browser row hosts the live preview while an earlier one keeps its one-liner; a URL announced again replaces its earlier row instead of stacking a duplicate; once the agent has ended, a preview with nothing captured falls back to the one-liner; and without the agent's identity every browser row stays plain text.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
