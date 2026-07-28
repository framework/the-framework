Single home for preference constants both the daemon and the dashboard must agree on: which keys a project may override, notification defaults, and the spend/concurrency slider bounds.

## TLDR

- `PROJECT_PREFERENCE_KEYS` (#840): the preference keys a project may override (autopilot, technical, vanilla, eco*, browser, autoPushBranch/autoOpenPr (#1102), transparent, model, agent, target, ...); `ProjectPreferences` is the `Pick<Preferences, ...>` of them.
- `NOTIFICATION_DEFAULTS` + `notificationEnabled()`: what an unset notification preference means; `discordNotificationEnabled()` composes method (`notifyDiscord`) AND category.
- Slider bounds shared browser↔daemon: `MAX_SPEND_OFFSET` (50pp) / `DEFAULT_SPEND_OFFSET` (half a day's worth of the week's allowance, #960); `DEFAULT_AUTO_PM_CONCURRENCY` (2) / `MAX_AUTO_PM_CONCURRENCY` (10) (#1204).

## Decisions

- A leaf module (no `node:*`) exported via `client.ts` so the dashboard reads the same values the daemon acts on — previously the key list was a second `Set<string>` in the dashboard (erasing the type link: a new key type-checked clean while silently routing to the global tier) and the notification defaults were open-coded in three spellings.
- No import cycle: `registry.ts` re-exports the key list from here and the `Preferences` import going the other way is type-only, so it erases.
- Project keys are the *user's* per-project choices, not the repo's: stored in the user's home file, not the committed `the-framework.yml`, because `model`/`agent` name what this machine runs.
- Notification polarities are deliberately non-uniform: the "needs you" baseline (`notifyBrowser`, `notifyHumanIntervention` #627) fires unless turned off; everything that reaches outward (Discord) or acts on what it reads (the Discord bot #680) is opt-in.
- `DEFAULT_SPEND_OFFSET` sits half a day *ahead* of the pace boundary: landing exactly on the boundary stops unattended work on normal jitter, not overspending; the cushion doesn't meaningfully loosen the #879 policy.
- `DEFAULT_AUTO_PM_CONCURRENCY` is 2, not 1: overlap is the point of the setting, and 1 would leave the feature invisible; 2 is the smallest number that shows it while staying quota-conservative.
