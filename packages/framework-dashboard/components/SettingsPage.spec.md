The settings page (#958): every global preference in one place — appearance, agent, run options, eco, notifications, automation, Claude web bridge — plus the non-dismissible Onboarding checklist.

## TLDR

- Sections: Appearance (theme, editor), Agent (agent, model pass-through, "Run on" target local/actions/web), `DevicesSettings` (a saved device is the other thing a session can run on), Run options + Eco (shared `runOptionRows` table with the launcher), Notifications (browser / Discord webhook / Human Queue / new activity / Discord bot), Automation (autoPm + spend offset), Claude web (browser bridge + `BridgeSettings`).
- Everything writes the GLOBAL preferences tier: `usePreferences`/`updatePreferences` scope by the project in the URL and `/settings` has none, so values set here are defaults, not one repo's override — per-project overrides stay in the launcher's gear.
- Run options come from the one shared `runOptionRows(preferences)` table (#958) so a rule cannot hold in the launcher and not here: Transparent overrides the rest, Eco is inert without the system prompt, Browser is Claude-only, Eco drops need Eco. A rule-disabled row is greyed *with its reason* rather than hidden — this is where you come to look.
- Notification rows split preference vs capability (#948): a toggle can't promise delivery the browser has blocked (`useNotificationPermission` disables the row) or the daemon can't do (`useNotifyChannels` — Discord rows say "Not configured" and offer a Set up dialog button, #1095); channels are shared with the checklist and bell so a saved credential settles all at once.
- Spend offset (#960): bounded ±`MAX_SPEND_OFFSET` in the input AND the onChange clamp (min/max only constrain the spinner — a typed 9999 was saved clamped to 50 while the box kept showing 9999); an untouched pref shows `DEFAULT_SPEND_OFFSET` (the half-day cushion) to one decimal, not a 0 the daemon isn't using.
- `onRunStarted(projectId, intent, runId)` is only forwarded to the OnboardingChecklist so a checklist-started session gets selected (#1169).

## Facts

- Generic row primitives: `Section` (Card), `Row`, `OptionToggleRow` (shared table row; `row.checked` is the effective value), `ToggleRow` (with optional capability `action` button), `SelectRow`, `TextRow`, `NumberRow` (clamps typed values).
- Discord setup dialogs (`DiscordBotDialog`/`DiscordWebhookDialog`) are controlled here and call `reloadNotifyChannels` on save.
