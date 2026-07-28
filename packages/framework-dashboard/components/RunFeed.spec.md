One run's feed: `RunOverview` + `EventList` over the live/replayed events, with a waiting/empty placeholder and a stream-lost banner.

## TLDR

- Shared by RunView (which sets `showSessionLink/showName/showStatus/showLoop` false because its action bar and right rail carry those) and RelayView (which keeps them, having no bar).
- `lost` (#948) renders a warning banner "Live stream lost — reconnecting…" so a dead connection is distinguishable from a quiet agent.
- `stick=false` + `openAt` support a finished static log that opens at its end (#1026); `emptyLabel` differentiates a live run waiting vs a finished one with nothing to replay; `tail` renders inside the scroller after the last row (a web run's live mirror box, #1265).
