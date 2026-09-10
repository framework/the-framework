What the tests cover:

- **The selection comes from the address** - the page reads the current address as its selection, and reads it again after a navigation.
- **Navigating adds a history entry** - so Back returns to where the user came from.
- **A correction replaces the current entry** - a navigation marked as a correction changes the address without adding a history entry.
- **Going where you already are** - navigating to the address already shown adds no history entry.
- **Back and Forward** - the page follows the browser's own history moves and re-reads its selection from the address they land on.
