The local half of running an agent on a saved device: this daemon — never the browser — drives the remote daemon and streams the agent back so it looks and behaves like a local one.

## User Stories

- The user starts an agent on a saved device and watches and steers it in the dashboard like a local one.
- The user sees a live online/offline dot for each saved device.
- The user reloads the dashboard and the remote agent is still in the list, re-openable.

## Flows

- The device's token stays between the two daemons and only ever in memory; the browser watches the agent over its normal same-origin channel, so nothing crosses origins in the browser and the token never reaches a page.
- Short health pings are how the device list's online/offline dots know what is reachable.
- A relayed agent keeps a local stand-in record, updated from the device's events, so it shows in the agent list and survives a dashboard reload. The device's address outlives the event stream: reads after the agent ends, push, and opening a PR still have to reach the device.
- Failures answer like local ones: an unreachable device is a plain error result or an empty read, and a rotated token ends the stream as a normal finish, not a lost connection.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
