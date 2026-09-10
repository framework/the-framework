What the tests cover:

- **One fetch for concurrent asks** - two asks for the same key while the fetch is still running share a single fetch and both receive its value.
- **Serving a known value** - a second ask answers the cached value without fetching again; past the trust window the ask still answers the old value at once and the refresh runs in the background, so the ask after it sees the new value.
- **The cold-ask budget** - a first ask whose fetch outlasts the budget answers no value and "pending" (not "none"), and the next ask answers the value once the fetch has landed.
- **A failed refresh** - a background refresh that fails leaves the last good value in place for the asks that follow.
- **Forgetting a key** - dropping a key makes the next ask fetch again.
