What the tests cover: a real timestamp renders as the viewer's local date and time, while an absent, empty or unreadable one reads as a dash — never as "Invalid Date" — and the caller may word that fallback itself ("no activity yet", "never").

Also covered: ages name seconds, minutes, hours, days, weeks and years, floored rather than rounded (a minute and a half reads as one minute) and staying relative even past a year; countdowns read "in 4 min" then "in 2 hr", and a moment already due reads "any moment" rather than as late; durations abbreviate to seconds, minutes, hours and days with no week unit, floor the same way, and never read below zero; the spelled-out duration pluralizes its unit for use in a sentence; and a quota reset names its weekday and bare time, with the tooltip spelling out the date and naming the time zone it is shown in.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
