What the tests cover: the daemon relaying the browser preview between the dashboard pane and an agent's Chrome.

- A browser preview address is understood as a project, an agent and which of the two directions it is: the live picture, or a click or key on its way back.
- Anything that is not a browser preview address — the dashboard's own pages, its assets, a truncated or over-long address, or a direction the preview does not serve — is not claimed, and is left for the dashboard's own app to answer. A query string does not confuse which direction was asked for.
- A malformed address, including one carrying a broken escape, is refused rather than allowed to fail — a failure there would take the daemon down.
- The live picture is relayed to the agent's Chrome and its stream comes back to the pane unchanged; a click or key posted by the pane arrives at the agent's Chrome with its content intact.
- An agent with no browser preview — one started without a browser, or one already finished — is answered with "no browser preview" without any attempt to reach a port.
- An agent whose Chrome is already gone is answered with a gateway failure rather than leaving the pane hanging.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
