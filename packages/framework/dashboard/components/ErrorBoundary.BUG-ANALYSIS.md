# Bug analysis: packages/framework/dashboard/components/ErrorBoundary.tsx

## Business logic (high-level)

The app-wide render-error net (#1194). Contract: children render untouched until a descendant
throws during render; then a themed, recoverable `role="alert"` card replaces the tree — naming
the error message when there is one — with "Try again" (clears the error, re-rendering = freshly
mounting the children; a durable cause throws right back, no worse) and "Reload"
(`window.location.reload()`) as the sure way out. `componentDidCatch` logs message + component
stack to the console — deliberately the one trace of a data-driven crash, since the daemon never
sees the browser console.

Edge cases: `error.message` empty → the `<pre>` is omitted (no empty box). Non-Error throws:
React passes whatever was thrown; `error.message` on a thrown string would be undefined →
message block omitted, card still renders (the `State` type lies slightly but nothing breaks).
Event-handler and async errors are not caught — correct; boundaries only catch render/lifecycle
errors, and the RPC layer has its own error handling. No listeners or timers, so no cleanup
concerns. Class component required (no hook equivalent) — correct choice.

## Functions (low-level)

- `getDerivedStateFromError` (L24): pure state derivation, per React contract. Correct.
- `componentDidCatch` (L28): logs with a stable prefix (test-pinned). Correct.
- `reset` (L37): `setState({ error: null })` — children were unmounted while the fallback showed,
  so the next render mounts them fresh, exactly what the comment claims. Correct.
- `render` (L39): fallback card as above; Reload uses full page reload. Correct.

## Bugs found

None found.
