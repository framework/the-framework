---
'@gemstack/the-framework': patch
---

The quota boundary (#879) now rises continuously with the clock — a plain pro-rated share of the elapsed week — instead of jumping to the next seventh once every 24 hours. A stepped boundary unlocked a whole day's worth of allowance the instant a new day began (including the entire week's worth on the last day), which read as generous on paper but let a burst of spending land the moment the clock ticked over rather than pacing with it. The usage panel's boundary line moves the same way it always did — it just draws whatever the framework reports — so this is purely a change to what auto PM and the panel treat as "on pace," not to the dashboard.
