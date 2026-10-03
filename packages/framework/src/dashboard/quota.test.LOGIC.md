What the tests cover:

- **The view the panel draws** - the windows and the time of the latest good reading are carried, with no failure reason when the reading succeeded, and the boundary is placed on the week's current day: the reading is on day 3 of 7.
- **The boundary moves with the clock** - on day 3 the boundary is read; two days later, with no new reading, it is on day 5 and further along the week.
- **A blip keeps the last reading, marked stale** - after a failed fetch the previous windows and their time are still shown and the failure reason is reported alongside them.
- **No reading is not an empty reading** - an account with no subscription quota shows no windows and no boundary at all, rather than a boundary of zero.
- **An unplaceable week** - a week whose reset cannot be placed in time is shown as a window but yields no boundary rather than a guessed one.
- **Stopping** - stopping the source ends the polling.
- **The panel stays about the account** - every reported window is shown, a model's week included, and the boundary is still the account's own week's.
