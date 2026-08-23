What the tests cover: how the bridge settings panel reports an extension the daemon is turning away.

- A browser extension blocked for being the wrong version is named as blocked, showing both the version it is and the version expected, plus where to reload it.
- An accepted version shows no such notice.
- A caller whose bridge token the dashboard rejects is reported, telling the user to save the token again in the extension's options.
- An accepted contact shows no rejection notice.
- When the same extension is both blocked on version and has been rejected on token, only the version message is shown — it carries the more specific cure, and two messages at once would ask for two things.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
