Module-scoped shared store of the daemon's notification channels (`NotifyChannels`) so the bell, the settings rows, and the Onboarding checklist read — and settle on — one value (#1095, #948).

## TLDR

- One cache + `useSyncExternalStore` subscribers, same shape as `preferences.ts` for the same reason; a write calls `reloadNotifyChannels()` so every reader converges at once.
- Loads are deduped: several components mounting together join the one in-flight read.
- A failed read keeps the last known state — a daemon hiccup is not evidence a credential went away, and blanking would flip every row to "not configured".
- `useNotifyChannels()` returns `null` until the first read lands ("not asked yet", which callers show as capable rather than lighting up "not configured" on a still-loading page); prerender snapshot is `null`.
- `NO_NOTIFY_CHANNELS` — the all-false, non-editable reading for callers that need a value rather than null.

## Problems

- The bug this exists for (#1095): three components showed the same fact from three independent polls, so saving a credential in one settled that one and left the others claiming "not configured" until their own timers came round — the page disagreed with itself about a fact the user had just established.
