The local half of running an agent on a saved device: this daemon — never the browser — drives the remote daemon and streams the agent back so it looks and behaves like a local one.

## TLDR

- The device's token stays between the two daemons and only ever in memory; the browser watches the agent over its normal same-origin channel, so nothing crosses origins in the browser and the token never reaches a page.
- Short health pings are how the device list's online/offline dots know what is reachable.
- A relayed agent keeps a local stand-in record, updated from the device's events, so it shows in the agent list and survives a dashboard reload; the device address outlives the event stream because reads after it ends, push, and PR still have to reach the device.
- Failures answer like local ones: an unreachable device is a plain error result or an empty read, and a rotated token ends the stream as a normal finish, not a lost connection.

## Before modifying/creating SPEC.md files

Always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
