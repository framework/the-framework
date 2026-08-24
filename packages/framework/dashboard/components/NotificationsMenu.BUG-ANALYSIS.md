# Bug analysis: packages/framework/dashboard/components/NotificationsMenu.tsx

## Business logic (high-level)

The sidebar bell + popover (#676), rendering the notification model's two axes as two groups:
"Deliver to" (Browser, Discord — methods) and "Notify me about" (Human Queue, New activity —
categories), every entry a preference toggle. The bell "reflects reality, not intent" (SPEC): it
lights (filled + dot, tooltip "Notifications on") only when a method can actually deliver —
Browser needs the toggle AND `permission === 'granted'`; Discord needs the toggle AND
`webhookReady`. Permission is requested exactly on the consent gesture (switching Browser on
while permission is `'default'`); a `denied` browser disables the toggle with the "Blocked"
hint; an unsupported browser omits the Browser row entirely.

Edge cases / invariants checked against the libs:

- Defaults: the real helpers (`src/preference-defaults.ts`) give browser=on, discord=off,
  humanIntervention=on, newActivity=off — so a fresh install with granted permission lights the
  bell, and Human Queue reads on-by-default but is a real toggle (#627). The component only
  *reads* through the named helpers, honouring the one-home-per-default rule.
- `webhookReady = channels === null || channels.discordWebhook`: null is "not asked yet" and is
  deliberately treated as capable (SPEC: no flicker to "off" on load; `useNotifyChannels`
  returns null until the first read and keeps last-known on a failed read). Correct.
- Permission tracking: `useNotificationPermission` is a `useSyncExternalStore` with a 3s polling
  backstop, so the state settles after `requestPermission()` resolves even on browsers without a
  permission-change event; the discarded promise (`void Notification.requestPermission()`) is
  therefore fine — the hook, not the promise, is the source of truth.
- `toggleBrowser` can only run when the row rendered, which requires `browserSupported`, so the
  bare `Notification` global access in it is safe.
- `browserHint` covers the SPEC's three Browser wordings (blocked / still needs allowing /
  delivers-while-open); "Click to allow browser notifications" shows only while the toggle is on
  with permission still `'default'` — clicking the row then toggles the preference off rather
  than re-prompting, which is slightly oblique wording but consistent with checkbox semantics
  and the SPEC's list; not a bug.
- Comment drift (not a bug, recorded): L23-24 claims "The Discord *bot* (#680) sits in its own
  'Chat' group" — no Chat group exists in this menu (or its SPEC); the bot control lives
  elsewhere now. Stale prose only.

## Functions (low-level)

- `NotificationsMenu()` (sole export):
  - Derived flags: `browser/discord/activity/needsYou` via helpers; `browserSupported`,
    `blocked`, `browserActive`, `anyActive` — each matches the SPEC sentence it encodes.
    Correct.
  - `toggleBrowser(next)`: write-through, then conditional permission request riding the click
    gesture (required for browsers gating prompts on user activation). Correct.
  - Render: Tooltip wrapping the DropdownMenuTrigger (composed via `render`); bell icon +/- dot
    by `anyActive`; two `DropdownMenuGroup`s with labels; Browser row conditional on support,
    disabled when blocked; Discord description switches on `webhookReady`; category rows write
    their keys. All four `onCheckedChange` handlers write the correct preference key with the
    passed boolean. Correct.

## Bugs found

None found.
