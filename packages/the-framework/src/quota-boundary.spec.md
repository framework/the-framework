Computes the quota boundary (#879): the pro-rated share of the account's weekly allowance that may have been spent by now, and measures the agent-reported quota windows against it.

## TLDR

- `parseResetsAt()`: parses the agent's year-less reset prose (`Jul 25 at 7am (Asia/Jerusalem)`) into an epoch, recovering the year because a weekly window resets within seven days.
- `boundaryFromResetsAt()`: the boundary as a continuous elapsed-share percent of the week, plus a 1-based `day` that steps at the week's own day rollover.
- `quotaBoundaryStatus()`: measures the account's weekly window (and the selected model's own weekly window) against the boundary plus the user's slider offset (#960); returns the window that reached the limit, or `undefined` for "we do not know".
- The whole policy is one line: the boundary is the elapsed share of the week — nothing to configure (replaces #519's configurable limits). Nothing is left on the floor (boundary reaches 100% exactly at reset), and unattended work cannot starve user-requested work.

## Problems

- The agent prints no year in the reset text, so the driver keeps it as text; here the year is recoverable by trying `nowYear ± 1` and picking the candidate nearest `now`.
- Time-zone math without a tz library: `zoneOffsetMs` derives the offset via `Intl.DateTimeFormat.formatToParts`; `zonedTimeToEpoch` does one DST correction pass (the first guess is only wrong across a DST change, and the second offset is the right one).
- Some runtimes print midnight as hour `24` under `hour12: false` with `'2-digit'` — normalized with `% 24`.
- Feb 29 in a non-leap year rolls into March; that candidate is rejected because it is not the date the agent printed. An unknown zone name returns `undefined` (nothing to fall back to that wouldn't be a guess).
- Newer Claude Code prints `Jul 25, 7am` where older prints `Jul 25 at 7am`; the regex accepts both, minutes and zone optional.

## Decisions

- `percent` is continuous, not stepped per day (#960 Edit): a stepped version unlocked a whole day's allowance the instant the clock ticked over (the entire week's worth on the last day), letting a spending burst land at midnight instead of pacing.
- Both weekly windows bind at once — the account's `week` and the selected model's `week-model` — measured against the same boundary; whichever reaches it first stops the work. A `week-model` window whose parenthesized model name doesn't match the selected model is left out rather than allowed to stop work for a model nobody selected.
- The limit is `boundary.percent + limitOffset`, clamped to 0–100 so a dragged limit can never read as "never stop" or "always stopped". Limit and boundary are separate values because the panel draws both.
- `undefined` (no reading / unparseable reset) means "we do not know", and each caller decides: the per-run guard carries on, unattended work stands down.

## Facts

- `QUOTA_WEEK_MS` = 7 days; `startsAt = resetsAt - QUOTA_WEEK_MS`.
- Default unattended limit sits a half-day cushion beyond the boundary (`DEFAULT_SPEND_OFFSET`, see registry/preference-defaults); `limitOffset` 0 means the limit *is* the boundary (#879 policy).
- The model of a `week-model` window is read from the parenthesized label, e.g. `Current week (Fable)` → `fable`, matched via `model.includes(name)`.
