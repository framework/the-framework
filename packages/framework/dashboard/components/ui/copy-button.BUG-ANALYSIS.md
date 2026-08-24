# Bug analysis: packages/framework/dashboard/components/ui/copy-button.tsx

## Business logic (high-level)

The copy-to-clipboard affordance (copy-button.SPEC.md): tooltip names what will be copied
(`label`), a successful copy flips the icon to a green check reading "Copied" for 1.5s, then
reverts. The ui/SPEC.md calls it "the copy-to-clipboard control that confirms the copy landed".

Behavior audit:

- Success path: `writeText(text).then(() => { setCopied(true); clearTimeout; setTimeout(1500) })`
  — the check only appears *after* the promise resolves, so the confirmation is honest. Rapid
  re-clicks reset the timer (clearTimeout before re-arm) — the check stays a full 1.5s after the
  last click. Correct.
- Unmount during the 1.5s window: the mount effect's cleanup clears the timer, so no
  setState-after-unmount. But an unmount while the *clipboard promise* is pending still calls
  `setCopied(true)` on a dead component — React 18 no-ops this without warning; harmless.
- Insecure context / no clipboard API: `navigator.clipboard?.` short-circuits the whole chain
  (optional chaining covers the `.then` too) — button silently does nothing. Acceptable: the
  dashboard runs on localhost/secure origins.
- Failure path: `writeText` can reject in real use ("Document is not focused", permission denied
  on some browsers). There is no `.catch`; see bug 1.

## Functions (low-level)

- `copy()` — see above. Verdict: bug found (rejection unhandled).
- `CopyButton` component — Tooltip wrapping a `type="button"` with `aria-label={label}`; icon
  swaps Check/Copy off `copied`; tooltip text swaps "Copied"/label. The Base UI render-prop
  pattern places the icon inside the rendered button. Verdict: correct.

## Bugs found

1. `L14`: **A rejected clipboard write is an unhandled promise rejection, and the failure is
   invisible.** `void navigator.clipboard?.writeText(text).then(...)` has no rejection handler:
   when `writeText` rejects (document not focused — easy to hit with devtools focused or during a
   fast tab switch; clipboard permission denied), the `.then`-derived promise rejects unhandled
   (console error / `unhandledrejection`), and the UI shows nothing — the user reasonably assumes
   the string was copied when it was not. The SPEC's point is that the click visibly lands; a
   failed copy showing the idle icon is defensible, but the unhandled rejection is the "broken
   error handling (unhandled promise)" category outright. Severity: minor. Fix sketch: append
   `.catch(() => {})` at minimum, or set a transient failure state (e.g. keep the tooltip saying
   the label so the user retries).

