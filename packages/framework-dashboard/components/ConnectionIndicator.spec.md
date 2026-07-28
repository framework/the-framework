The navbar "connected to <label>" indicator (#1052): which daemon the dashboard is talking to, derived from the browser's origin.

## TLDR

- Every transport is same-origin, so the origin IS the connection: loopback = this machine's daemon ("Local"), any other origin = a device you hopped to (`currentConnection` from `lib/profiles.ts`).
- Remote connections render accented (primary-tinted border/background) so a box running on someone else's hardware is never mistaken for your own; Local is muted and hidden below `sm`.
- Status dot: trivially online on Local; on a remote device it follows the `useDeviceStatus` poll (#1072).
- On mount, remembers the loopback origin (`rememberLocalOrigin`) so "Local" can return to the right port later, and stashes any carried draft out of the URL (`stashDraftFromUrl`, #1066) at SPA boot before it reaches the address bar.
