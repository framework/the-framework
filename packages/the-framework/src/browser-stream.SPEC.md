Streams the agent's headless browser to a human — the latest screen frame as a simple image stream, with clicks, typing, scrolling and navigation posted back — so when an agent parks asking someone to deal with a login wall or captcha, there is actually a page to act on.

## Flows

- Follows the agent: always shows the tab it is working in, re-attaching when it opens or switches tabs, and announces each real page change so the transcript can show the pane at the point of use.
- A still page is exactly the parked case, so the newest frame is re-sent on a timer to keep the pane painted.
- Loopback only, and no frame is ever persisted: frames can show a password being typed.
- Malformed input never reaches the browser; a browser with no page, or one that stops answering, costs the pane, never the agent.

## Rationales

- The agent hosts the bridge itself because opening the browser's remote-control socket to web origins would let any page the user visits drive the agent's browser; that socket stays unreachable, and this bridge is the only way in.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
