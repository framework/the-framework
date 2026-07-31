---
'@gemstack/the-framework': patch
'@gemstack/framework-dashboard': patch
---

The live run feed no longer blanks mid-run on a stream reconnect (#1383). Every subscribe replays the whole log before following live, and the client used to clear its feed first — so after a transient channel drop the "stream lost" banner cleared and the transcript sat empty, bannerless, until the replay refilled it. The on-disk tail now sends a wire-only `stream-sync` marker when its replay is delivered, and a reconnecting client buffers the replay and swaps atomically on it — the feed never shows less than it already showed, the same rule #1402 set for the archive read. In-memory sources (the relay, relayed device runs) send no marker and fall back to a short grace deadline; a reconnect that dies mid-replay drops its partial buffer rather than swapping it in.
