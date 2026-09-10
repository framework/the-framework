What the tests cover:

- **The view the panel draws** - the windows and the time of the latest good reading are carried, with no failure reason when the reading succeeded, and the boundary is placed on the week's current day: on day 3 of 7, three sevenths of the week are allowed and a week at 16% has reached nothing.
- **The boundary moves with the clock** - a week at 50% on day 3 has reached the boundary; two days later, with no new reading, the same 50% is under the line on day 5.
- **A blip keeps the last reading, marked stale** - after a failed fetch the previous windows and their time are still shown and the failure reason is reported alongside them.
- **No reading is not an empty reading** - an account with no subscription quota shows no windows and no boundary at all, rather than a boundary of zero.
- **An unplaceable week** - a week whose reset cannot be placed in time is shown as a window but yields no boundary rather than a guessed one.
- **Stopping** - stopping the source ends the polling.
- **The default spend offset** - with no slider position, the limit sits the default half-day cushion above the boundary.
- **The panel stays about the account** - every reported window is shown, a model's week included, but only the account's week is measured, so a fully spent model week nobody named does not make the bar say the account is out.
- **Naming the model** - brings that model's own week into the gate, where it is the window reached, while the account-wide answer is still unreached; a model whose week the account never reported is gated on the account's week alone; asking with no model answers the same as the panel.
