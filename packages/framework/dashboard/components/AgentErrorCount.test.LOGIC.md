What the tests cover, for the count of errors an agent reported:

- **No errors, nothing shown** - an agent that reported no errors renders nothing.
- **One error** - reads "1 error", with its headline beside it where the row has room.
- **A tight row** - shows the count alone and no headline, because a clipped headline is worse than none.
- **Several errors** - read "<N> errors", and the headline shown beside the count is the latest one, never an earlier one.
