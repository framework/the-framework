The pump behind a relayed agent's live feed: it moves the agent's in-memory event stream — buffered history first, then live — into a plain callback, one call per event.

## Flows

- The viewer leaving stops the pump and cancels the source, so nothing keeps following an unwatched agent.
- A source that runs out on its own — a relayed agent that finished — fires a done signal, so the viewer's feed closes instead of staying open like a live agent gone quiet.

## Rationales

- Transport-agnostic on purpose: what a value becomes on the wire is the business of the HTTP layer that mounts the stream, which is what lets this pump be driven and tested by itself.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
