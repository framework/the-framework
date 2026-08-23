What the tests cover: how the dashboard resolves and changes the settings in force.

- **Loading** - the first read of the user's own preferences populates the shared answer; a toggle made while that read is still in flight survives it, rather than being overwritten by the pre-toggle value.
- **Two tiers** - the open project's committed `the-framework.yml` overrides the user's own preferences key by key, contributes its own keys, and leaves keys it says nothing about to the user's tier; a project that commits nothing changes nothing.
- **Provenance** - each resolved setting reports whether the repo or the user's own preferences set it.
- **One writable destination** - a toggle only ever writes the user's own tier, while the repo's committed keys keep winning over it.
- **Re-reading the repo tier** - an edit to a project's `the-framework.yml` is picked up on the next re-read, and a deleted file stops contributing altogether instead of lingering; a failed project read is swallowed, leaves the other tier intact, and does not stop the next re-read from working.
- **Stale-tab protection** - a change sends only the keys it changed rather than replaying everything the tab happens to hold; it adopts the settings the daemon reports back, so a stale tab converges on what another tab changed; an older change's reply arriving after a newer one does not undo the newer one; a re-read fired while a change is still in flight does not overwrite it; and a rejected change leaves the value the user chose on screen.
- **Theme** - no chosen theme means following the operating system; a fixed choice ignores the operating system, while following it tracks whether it is dark.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
