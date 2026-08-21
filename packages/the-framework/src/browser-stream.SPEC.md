Streams the agent's headless browser to a human — the latest screen frame as a simple image stream, with clicks, typing, scrolling and navigation posted back — so when an agent parks asking someone to deal with a login wall or captcha, there is actually a page to act on.

## User Stories

- The user watches, live in the dashboard, the very page the agent's browser is on.
- When the agent parks on a login wall, captcha, or 2FA step, the user clicks, types, scrolls, and navigates in the agent's own browser to clear it.
- The user types a password through the pane and no frame of it is ever stored.

## Flows

- The pane follows the agent: the user always sees the tab the agent is working in — re-attaching when the agent opens or switches tabs — and each real page change is announced so the transcript can show the pane at the point of use.
- A parked agent's page is still, and a still page emits no new frame — so the newest frame is re-sent on a timer and the user sees the page rather than a blank pane.
- Loopback only, and no frame is ever persisted: frames can show a password being typed.
- Malformed input never reaches the browser; a browser with no page, or one that stops answering, costs the pane, never the agent.

## Rationales

- The agent hosts the bridge itself because opening the browser's remote-control socket to web origins would let any page the user visits drive the agent's browser; that socket stays unreachable, and this bridge is the only way in.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
