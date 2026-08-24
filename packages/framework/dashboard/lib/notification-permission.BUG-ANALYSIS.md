# Bug analysis: packages/framework/dashboard/lib/notification-permission.ts

## Business logic (high-level)

One subscribable answer to "may this page show desktop notifications?": `granted`/`denied`/`default` from `Notification.permission`, or `'unsupported'` where the constructor is absent (per SPEC). Kept current by a 3s polling backstop because not every browser fires a permission-change event and the user can flip the setting outside the page. Shared by the notifications menu and the Onboarding checklist so there is one backstop, not two.

Lifecycle: each subscribed component's `useSyncExternalStore` subscription starts its own `setInterval` and clears it on unsubscribe — no leak; N subscribers means N cheap timers, accepted redundancy. The snapshot function reads the live value each call; `useSyncExternalStore` only re-renders when the returned string changes, so the 3s tick is render-free while nothing changed. `Notification.permission` returns the same primitive string, so snapshot identity is stable (no infinite-loop hazard).

Edge cases:

- SSR/prerender: server snapshot is `'unsupported'`; on the client the first snapshot read replaces it. On a browser with real support this causes exactly one expected hydration correction — the standard `useSyncExternalStore` pattern.
- `typeof Notification === 'undefined'` guards the client snapshot too (iOS Safari in some contexts, hardened browsers) → `'unsupported'`. Correct per SPEC.
- The permission changing right after our own `requestPermission()` resolves is covered by the resolve-triggered re-render (noted in the comment); the poll covers external flips.

## Functions (low-level)

- `useNotificationPermission()` — returns `NotificationPermission | 'unsupported'` via `useSyncExternalStore(subscribePermission, clientSnapshot, serverSnapshot)`. No inputs. The three-callback wiring is right: subscribe is stable (module fn), snapshots are pure reads. Verdict: correct.
- `subscribePermission(onChange)` — `setInterval(onChange, 3000)`, cleanup clears it. Calling `onChange` unconditionally is fine: the store layer diffs snapshots. Verdict: correct.

## Bugs found

None found.
