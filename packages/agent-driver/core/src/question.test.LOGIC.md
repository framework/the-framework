What the tests cover, on the question parser alone:

- **Not a question** - no block, a block that is not JSON, a block with no options, and a block whose options have no labels.
- **A well-formed block** - options with ids, labels, one-liners and the stop flag; the recommended id; the file; a multi-select with its defaults.
- **Tolerance** - ids made from position, the fallback title, a recommended label mapped to its option's id, an unknown recommended dropped.
- **The last usable block** - the newest block wins, and a malformed last block falls back to the one before it.
- **The continuation prompt** - its exact wording.
