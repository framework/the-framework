What the tests cover:

- **The view the panel draws** - the windows and the time of the latest good reading are carried, with no failure reason when the reading succeeded, and the boundary is placed on the week's current day, day 3 of 7.
- **The boundary moves with the clock** - two days later, with no new reading, the boundary is on day 5 and allows a larger share of the week than before.
- **A blip keeps the last reading, marked stale** - after a failed fetch the previous windows and their time are still shown and the failure reason is reported alongside them.
- **No reading is not an empty reading** - an account with no subscription quota shows no windows and no boundary at all, rather than a boundary of zero.
- **An unplaceable week** - a week whose reset cannot be placed in time is shown as a window but yields no boundary rather than a guessed one.
- **Stopping** - stopping the source ends the polling.
