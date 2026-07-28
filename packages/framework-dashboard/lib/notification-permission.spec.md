Exposes the browser's `Notification.permission` as a subscribable React value (#627) — shared because the Onboarding checklist (#958) asks the same question as the notifications menu, and a second copy of the polling backstop would be a second thing to keep right.

## Facts

- No permission-change event fires on every browser, so the subscription polls every 3s as a backstop; the value also changes right after our own `requestPermission()` resolves, which re-renders anyway.
- Returns `'unsupported'` where `Notification` is undefined, and as the server snapshot.
