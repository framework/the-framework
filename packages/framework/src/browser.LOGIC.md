The two things launching a Chrome with its DevTools port [1] open needs, whoever launches it: a port nobody holds, and a way to know the port answers.

## Context

**User story**: the user turns on the bridge browser; the daemon launches its own Chrome for Testing and talks to it over the DevTools port. The launch must not collide with a port already in use, and must not talk to a Chrome that is not listening yet.

The bridge browser is the one caller. The agent's own browser, which the daemon's former run process launched with the same two helpers, is gone with that process.

## Glossary

[1] DevTools port: the local port a Chrome opens when started with `--remote-debugging-port`, through which another process drives it.

## Business logic — TL;DR

- **A free port** - a localhost port is asked of the operating system rather than guessed; no port is an error.
- **Waiting for Chrome** - Chrome's `/json/version` is polled until it answers, within a bound; the answer is whether it did.

## Business logic

### A free port

#### Context

See `## Context`.

#### Business logic

A port is obtained by listening on port 0 of `127.0.0.1`, reading the port the operating system gave, and closing the listener. A listener that cannot start, or that reports no port, is an error to the caller.

### Waiting for Chrome

#### Context

Chrome opens its DevTools port [1] a beat after its process starts, so connecting at once is a race.

#### Business logic

`<browser url>/json/version` is requested every 100 ms until it answers with a success status, for at most 15 seconds; both numbers can be given by the caller (the bridge browser waits 30 seconds). An answer in time is `true`; none is `false`. A request that fails counts as "not listening yet" and is retried.
