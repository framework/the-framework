What the tests cover, against a throwaway project directory on disk:

- **The event stream a tail follows** - no agent id, or a traversal-shaped one, resolves to the project root's event stream; an existing checkout under `.branches/` resolves to the event stream inside it; an ended agent whose checkout is gone resolves to its archived event stream rather than the root's; a run filed under a person's directory on the `agent-data` branch is found; a live checkout beats a stale archive, as for a continued agent; an unknown id with no record keeps the root's event stream as the fallback.
