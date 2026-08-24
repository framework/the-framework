# Bug analysis: packages/framework/dashboard/components/AddProjectPanel.tsx

## Business logic (high-level)

The "Add project" modal (#396/#1150/#439): mounting it immediately asks the daemon to open the OS
folder picker (`sendPickProjectDirectory`), because a browser page cannot learn an absolute path
on its own. Phases are derived from state: *picking* (`path === null`, no error), *pick error*
(`pickError` set — reason plus Try again/Cancel), *trust* (`path` set — path echoed, plain
prompt-injection warning, Choose again / "I trust it, add it"), *done* (`added` set — "Project
added" / "Already added", auto-close after 2.5s or Done). Per the SPEC:

- **The system dialog is the form** — pick on mount; a dismissed picker (`path: null`) closes the
  modal (`onClose`); a picker that cannot open shows its reason with Try again. Holds.
- **Trust gate before installing** — nothing calls `sendAddProject` until the trust button;
  `confirmAdd` guards on `busy` and `path`; a failed add is routed by `useAction` into `error`
  and rendered in place on the trust step (state stays, so the user can retry or re-pick). Holds.
- **Says what happened** — `alreadyActivated` selects the wording; auto-close timer cleaned up on
  unmount; Done closes sooner. Holds.
- **Dialog contract** — Esc closes, Tab cycles inside, focus returns to the opener, click-away
  closes. Partially holds: the trap/Esc handler is a `keydown` listener on the modal's own
  subtree, so it only works while focus is *inside* the panel — and the first two phases render
  no autofocused element, so on open focus stays wherever it was (the now-gone menu item → body,
  or a focus-restoring dropdown trigger), where Esc and the Tab trap do nothing (Bug 1).

Concurrency/ordering: `pick()` is not covered by `busy`, so rapid double-clicks on "Choose
again"/"Try again" fire two concurrent `sendPickProjectDirectory` calls (two native dialogs or a
daemon-side refusal — daemon behavior not verified; suspicious-but-unproven, not filed). State
updates after unmount (user closes the modal while the OS dialog is open, then picks/dismisses)
are React no-ops; the dismissal path would call `onClose()` a second time, which parents treat
idempotently. Closing mid-`confirmAdd` lets the add complete daemon-side without `onAdded()` —
the sidebar then catches up on the 30s projects poll; accepted, not filed.

## Functions (low-level)

- **mount focus effect (L24-27)** — captures `document.activeElement` at mount, refocuses it on
  unmount. Whether the captured element is the dropdown trigger (comment's claim) or `body`
  depends on the opener's own focus handling; either way the *return* half is best-effort and
  harmless. Correct-ish; the *initial* focus placement is the gap (Bug 1).
- **`pick()` (L31-44)** — clears `pickError`, calls the RPC with a catch that synthesizes
  `{ok:false, error:'Could not reach the daemon.'}` (so a transport failure lands in the same
  error phase — good); `!picked.path` → `onClose()` (dismissed); success → `reset()` (clears a
  stale add error from a previous trust round) then `setPath`. The `reset()` placement matters
  and is right: a re-pick after a failed add starts the new trust step clean. Correct.
- **mount pick effect (L45-48)** — fires once. Correct.
- **auto-close effect (L51-56)** — timer keyed on `added`, cleared on unmount/re-run; `onClose`
  deliberately out of deps (fresh closure). Correct.
- **`confirmAdd()` (L59-66)** — busy/path guard; `run` maps `{ok:false,error}` and throws into
  `error` with the fallback; success records `alreadyActivated` and calls `onAdded()` before the
  timed close. Correct.
- **`onKeyDown(e)` (L69-89)** — Esc → preventDefault + close; Tab → cycle among
  `button, input, [tabindex]:not([tabindex="-1"])` minus disabled, wrapping at both ends. The
  query is computed per keypress (fresh across phases — good). Only receives events from inside
  the panel subtree (Bug 1 window aside, the trap itself is correct; during `busy` both buttons
  are disabled, `focusable` can be empty, and the `!first || !last` guard bails cleanly).
  Correct in itself.
- **render (L91-162)** — backdrop div closes on click; panel `role="dialog" aria-modal aria-label`;
  the four phases ordered `added` → `pickError` → `path` → picking, which resolves the state
  combinations correctly (an `added` result keeps showing even though `path` is still set; a
  `pickError` can only coexist with `path` from a failed re-pick — error wins, and Try again
  leads back). `autoFocus` on the trust and Done primary buttons pulls focus into the dialog from
  those phases on. Correct.

## Bugs found

1. `L92` (with L147-158, the picking phase): **Esc (and the Tab trap) do not work when the dialog
   opens, because nothing inside the modal is focused in the picking and pick-error phases.** The
   dialog contract is implemented as a `keydown` handler on the modal wrapper, which only sees
   events dispatched to its own subtree; the picking phase (and the pick-error phase on first
   entry) renders no `autoFocus` element, so after the opener menu item unmounts, focus sits on
   `body` (or on a dropdown trigger that restored focus to itself) — outside the wrapper. A user
   who opens "Add project" and presses Esc gets nothing; Tab walks the page underneath the modal
   overlay. This contradicts the SPEC's explicit "Esc, Cancel, and clicking outside the modal
   close it without adding; keyboard focus stays inside the modal". The trust step masks the bug
   later via its autofocused button. Severity: minor. Fix: give the picking phase's Cancel button
   (and the pick-error phase's Try again) `autoFocus` — or attach the Escape handler to
   `document` for the dialog's lifetime.
