What the tests cover:

- **Real timestamps** - a readable timestamp is shown as the viewer's own local date and time, and as the local date alone.
- **Unreadable timestamps** - a missing, empty or unparseable timestamp reads as an em dash rather than "Invalid Date", for the full date, the date alone and the age alike; and the caller can word the placeholder itself, as "no activity yet" or "never".
- **How long ago, in full detail** - seconds, minutes, hours, days, weeks and years are each named ("22s ago", "30m ago", "3h ago", "5d ago", "2w ago", "1y ago"); the moment right now reads "0s ago"; and the span is floored, so a minute and a half reads "1m ago" rather than "2m ago".
- **How long until** - a moment within the hour counts down in minutes ("in 4 min") and a further one in hours ("in 2 hr"), while a moment already passed, or exactly now, reads "any moment" instead of as overdue.
- **Durations, compact** - seconds, minutes, hours and days are named, floored, with no week unit ("2s", "0s", "1m" for a minute and a half, "10m", "2h", "1d" for a day and two hours, "9d"); a negative span reads "0s".
- **Durations, spelled out** - the same span written for a sentence, with the unit pluralized only past one ("1 second", "2 seconds", "1 minute", "10 minutes", "1 hour", "2 hours", "1 day" for a day and two hours, "2 days").
- **When the quota resets** - the short wording names the weekday and a bare time of day with no date, and the full wording reads "Quota resets on <month and day>, <time> (<time zone>)", naming the zone the time is shown in.
