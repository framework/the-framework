The DevTools connection [1] to a Chrome the daemon owns: the bridge browser's.

## Context

**User story**: the user turns on the bridge browser; the daemon drives its own Chrome (open the sign-in window, hide it, read a page's state) by sending it DevTools commands.

**Problem**: Chrome refuses DevTools socket connections that carry an `Origin` header unless it was launched with `--remote-allow-origins`, and allowing origins would let any page the user visits drive that browser. So the DevTools port stays unreachable from the web, and the daemon's process is the only one that talks to it.

The screencast of an agent's browser to the dashboard, which used to live here, is gone with the daemon's former run process.

## Glossary

[1] DevTools connection: a WebSocket to a Chrome's debugger address, over which commands are sent as JSON and answered by id.

## Business logic

A connection is opened to the debugger address given; a socket that cannot open is an error naming the address. A command is sent with the next id and its parameters, and resolves with Chrome's result for that id, or rejects with Chrome's error message ("CDP error" when Chrome gave none); a send that throws rejects at once. A message that is not JSON, or that answers no pending command, is ignored. Closing closes the socket. The connection is injectable, so a test stands in for Chrome.
