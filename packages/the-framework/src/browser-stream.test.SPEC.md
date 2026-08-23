What the tests cover: the browser preview — the live picture of the agent's browser and the input a person sends back into it.

- **Which page is shown**: the agent's current tab rather than the first one it ever opened; tabs with no live connection and non-page targets are skipped; a browser with no page yields nothing.
- **Following the agent**: opening another tab re-attaches the preview to it and stops the old one, so the pane never goes blind; a browser that stops answering leaves the pane serving the page it already had.
- **Announcing the page**: the first real page is announced, then every navigation in place and every followed tab switch, never the same address twice in a row, and never a browser idling on a blank page — which still streams, only unannounced.
- **Input**: a click is delivered as a press and a release; typing is delivered as inserted text so non-ASCII characters arrive as characters; navigation accepts only ordinary web addresses and refuses script and file addresses; malformed input reaches the browser as nothing at all and is rejected back to the sender.
- **Painting**: the last known picture is delivered to a pane that opens on a still page, and the picture keeps being re-sent so it actually paints; a viewer leaving stops the repeat without taking the preview down.
- **Privacy and lifecycle**: the preview is served on this device only; closing it stops the streaming and frees the port, and closing twice is harmless.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
