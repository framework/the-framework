What the tests cover: saving devices and hopping between them.

- **Saving** - devices are saved, listed newest first, and dropped again; a device given no name is labelled by its host and port; saving the same machine again refreshes its token instead of adding a second entry; and saved devices survive a page reload because they live in the browser's own storage.
- **Reading a pasted URL** - the origin and the token are pulled out of the URL a daemon prints, including one with surrounding whitespace or an extra path; a URL with no token yields an empty token; anything that is not a URL is rejected.
- **Hopping** - the hop URL carries the token, and carries no token when returning to the local machine; it also carries the composer draft, with or without a token, and drops an oversized draft while still connecting; hopping navigates the browser to that URL.
- **Connected indicator** - a loopback dashboard reads as "Local", a saved machine by its label, and an unsaved one by its bare host.
- **Returning local** - "Local" goes to the default daemon address until a loopback origin has been remembered, then to the remembered one; a non-loopback origin is never remembered.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
