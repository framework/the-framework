The one `node:fs/promises` adapter; every `node*Fs()` factory in the package returns this implementation under its own narrower consumer-contract interface.

## TLDR

- `NodeFs`: read/write/append/exists/isDirectory/mkdir(recursive)/readdir/rename(atomic within one fs)/chmod.
- Forgiving reads: `exists`/`isDirectory` treat any stat error as `false`; `readdir` on a missing dir yields `[]`; `read`/`rename`/`chmod` reject.

## Decisions

- Every import is dynamic on purpose: a module that reads files keeps `node:fs` out of its static import graph so it stays reachable from browser-safe code as long as the read never runs there; `client.test.ts` enforces the graph half.
- Consumer interfaces (store may append, registry may not) stay separate — only the implementation is shared, having been written out four times before this.
