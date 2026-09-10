What the tests cover:

- **The browser entry stays browser-safe** - nothing the dashboard's shared entry offers, and nothing those rules reach in turn, depends on a capability that exists only outside a browser: the whole chain of what would ship to the browser is checked, and one such dependency anywhere in it fails and names the path that introduced it. This is what keeps the dashboard from breaking when a rule that gained a server half — reading a file from disk, for instance — is shared with the browser as-is.
