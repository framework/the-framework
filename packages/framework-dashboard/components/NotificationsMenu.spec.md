The shell header's single "Notifications" bell (#676): one popover grouping delivery methods (Browser, Discord), notification categories (Human Queue, New activity), and the Discord bot — replacing three loose header icons.

## TLDR

- Purely the header control over existing preferences: each `DropdownMenuCheckboxItem` writes straight through `updatePreferences`; the underlying prefs/hooks are unchanged.
- Model made legible: bell + Discord are *delivery methods* (where a notification goes), "New activity" is a *category* on top of the "needs you" pings; "Human Queue" defaults on but is a real toggle now, no static "Always on" row (#627).
- The bell reads active (Bell icon + primary dot, tooltip "Notifications on") only when a method is *effectively* on: Browser needs `permission === 'granted'`, Discord needs both the preference and the daemon credential — a toggle without the daemon env var lit the bell for a channel delivering nothing (#948).
- Channel capability comes from `useNotifyChannels()`, shared with the settings page (#1095); `null` (first read pending) counts as capable so a configured setup doesn't flicker.
- Unconfigured channels say so inline ("Not configured — add a webhook/bot token in Settings"); a denied browser permission disables the Browser toggle with "Blocked in your browser settings"; unsupported hides it.
- Enabling Browser calls `Notification.requestPermission()` in the same click — the request must ride a user gesture.

## Decisions

- The Discord bot (#680) sits in its own "Chat" group, not under "Deliver to" (#916): everything else posts outward, the bot takes messages in and starts/steers sessions — and it never lights the bell, which is about notifications.
