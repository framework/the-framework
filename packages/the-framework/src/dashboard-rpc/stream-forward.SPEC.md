Pumps a live in-memory event stream — the feed of an agent this daemon is relaying from a device — to the browser watching it, one event at a time.

Events are forwarded as they arrive until the source runs out or the subscriber stops. A source that ends on its own is announced as finished, so the browser can tell "this agent is over" from "nothing has happened yet" instead of holding an open connection on a feed that already ended. Stopping halts the forwarding and releases whatever was waiting for the next event, and stopping twice is harmless. Subscribing to a feed that does not exist does nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
