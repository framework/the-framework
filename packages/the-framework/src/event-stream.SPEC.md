Keeps a running agent's framework events in memory so that any number of surfaces can follow along at once, each from the very beginning.

## Business logic — TL;DR

- **Nothing is missed by arriving late** - every event is kept, so a consumer that starts watching mid-agent first receives everything that already happened and then continues live; consumers advance independently of each other.
- **Replay from a point** - the events buffered so far can also be handed out from a given position onwards, which is how a surface asks for only the tail of an agent's history.
- **Ending is orderly** - once the stream is closed no further event is accepted, and each consumer still finishes reading what was already buffered before it is told the agent is over.
- **A consumer that goes away is forgotten** - a surface that disconnects (for example, a dashboard tab closing mid-agent) stops being tracked immediately instead of lingering until the agent ends.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
