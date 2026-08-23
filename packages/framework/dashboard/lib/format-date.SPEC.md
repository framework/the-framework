Every date, duration and countdown the dashboard shows, worded the same way everywhere.

## Business logic — TL;DR

- **A bad timestamp never reaches the user** - timestamps arrive unvalidated (an agent's start time, a ticket's date read out of its filename), so anything missing or unreadable shows as a dash instead of the browser's literal "Invalid Date".
- **Three absolute forms** - the full local date and time; a short date and time without seconds, for places where the timestamp stands in as an agent's name; and the date alone for dense table columns.
- **Age is always relative** - "22s ago", "30m ago", "5d ago", "2w ago", "1y ago": the Agents list dates every row this way, so a row reads the same whether it finished this minute or last year, with the exact moment available on hover.
- **Freshness falls back to a date** - the at-a-glance boards read "just now", "12m ago", "3h ago", "2d ago", and past a week switch to the local date.
- **Counting down never reads as late** - "in 4 min", "in 1 hr"; a scheduled moment the daemon has not reached yet reads "any moment", because it is imminent rather than overdue.
- **Durations come abbreviated and spelled out** - "2s", "10m", "2h", "1d" for a figure, and "2 seconds", "10 minutes", "2 hours", "1 day" for a sentence explaining that figure.
- **Ages and durations are floored, never rounded** - "1m ago" means at least a minute has passed, not "closer to one minute than to two".
- **A quota reset is named by weekday** - "Tuesday 8:59pm", since the quota week shown above it already places the day; the full tooltip adds the date and names the time zone, so a user in another zone never has to guess whose clock the reset follows.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
