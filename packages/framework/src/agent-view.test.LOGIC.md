What the tests cover:

- **The driver session behind the agent** - the session opening and the latest session update merge: the driver from the opening, the session id and link from the update; a stream with no session opening yields no driver session; the checkout from the opening survives a later session update, so a checkout removed since is still nameable and the id and checkout together can reopen the session; the model is per leg: the latest session opening wins, and one that recorded no model clears it.
