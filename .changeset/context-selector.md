---
'@gemstack/framework': minor
---

Add the context selector and trust-on-add to the dashboard (#439, part of #314). The Start form gains a "Context" picker — tick the registered repos to focus the agent on, and each becomes one `Context: <dirs>` line in the run's system prompt (the agent can still reach every repo; this just narrows where it looks). Threaded through as a repeatable `--context <dir>` CLI flag and `StartRunOptions.context`. Adding a project now asks "do you trust this repository?" first, warning about prompt-injection risk before the agent is given read access.

Also hardens the daemon's Telefunc mount: a bare `GET /_telefunc` (which a browser tab issues on reconnect) made telefunc throw an unhandled rejection that crashed the daemon; the mount now catches it and returns 400.
