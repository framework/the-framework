What the tests cover:

- **Nothing before the first answer** - the panel has no reading until the daemon answers, which is distinct from a reading of nothing used.
- **Refreshed every 30 seconds** - a later reading replaces the earlier one on the next beat, with no action from the user.
- **A failed refresh keeps the last reading** - a call the daemon cannot answer leaves the previous reading on screen instead of blanking the bar, which would read as "nothing used".
- **Asking stops when the panel goes away** - no further readings are requested once the panel is off screen.
