What the tests cover:

- **Holders of one checkout run one at a time, in arrival order** - a second holder of the same checkout does not start while the first is still parked, and runs once the first has finished.
- **Different checkouts never contend** - a holder of another checkout finishes while the first is still parked.
- **A failure stays with its holder** - a holder that throws surfaces its own error to its caller, and the next holder of the same checkout still runs and gets its own result back.
- **The key is the resolved path** - two spellings of the same checkout (`/tmp/a/.` and `/tmp/a`) contend on one key.
