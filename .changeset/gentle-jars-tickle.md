---
'@gemstack/framework': patch
---

Stop a failed log tail from killing the daemon. `followFile`'s pump had no `catch` and every caller discarded its promise, so a rejected read (EIO on a network mount, EISDIR, a log grown past `kMaxLength`) surfaced as an unhandled rejection and exited the process, taking every connected dashboard stream with it. The same function installed no `'error'` listener on its `FSWatcher`, where an error event with no listener throws out of the emitter. Both are now absorbed, and the poll backstop carries the tail on its own once a watcher is lost.
