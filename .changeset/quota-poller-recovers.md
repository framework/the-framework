---
'@gemstack/the-framework': patch
---

The usage bar no longer disappears for the rest of the daemon's life after one usage readout the framework could not parse. A single unrecognized answer used to be treated as a statement about the account, which wiped the retained reading and stopped the poller permanently, so the panel fell back to a sentence and looked as though the bar had been reverted. An unparseable answer describes that one read, not the install, so it is now transient like a failed fetch: the reading is kept, the poller keeps asking, and the panel dates the numbers it is still showing rather than presenting them as current.
