Makes the browser's address the dashboard's live selection: every part of the page reads what the address currently selects, and navigating is writing a new address. Because the address is the selection, Back and Forward work with no extra bookkeeping, and every page is a link the user can paste, reload and open twice.

The path is read into a selection and a selection written back into a path by the rules in `route.ts`; only the path is read, so the query string a page keeps its own filters in never changes what is selected.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **The page follows the address** - the whole dashboard re-reads its selection whenever the address changes, whether the change came from a click inside the page or from the browser's Back and Forward buttons.
- **Navigating adds a history entry** - so Back returns to where the user came from.
- **A correction replaces the entry instead** - a navigation marked as a correction, such as the dashboard filling in the id of the agent [1] it has just started, overwrites the current entry so Back does not step into a half-formed address.
- **Going where you already are does nothing** - navigating to the address already shown adds no history entry and changes nothing, so a repeated click never fills the history with copies of one page.
