The app-wide React error boundary (#1194): turns an escaped render error into a recoverable card instead of a white blank screen.

## TLDR

- Without any boundary, React unmounts the whole tree to the root on an escaped render error — one bad line off the live feed or one panel reading a field the daemon has not written yet took the entire app, and with `ssr:false` there was not even an SSR error page. The crashes looked random because they were data-driven (a particular event, poll, moment).
- Fallback is a `role="alert"` card on the themed shell: the message, the error text, "Try again" (clears state, re-mounting the children), and "Reload" (the sure way out).
- "Try again" works for transient causes (a stream hiccup, a half-written read the next poll completes); a durable cause throws straight back here, no worse than before.
- `componentDidCatch` logs error + component stack to the console: the daemon never sees the browser console and a blank page carries no trace, so this is the one record of a "random" crash.
