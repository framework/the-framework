# Bug analysis: packages/framework/dashboard/components/ui/dialog.tsx

## Business logic (high-level)

The plain centered modal (dialog.SPEC.md) on Base UI's Dialog, deliberately *with* light dismiss:
Escape and backdrop click close it (Base UI's Dialog default — modal but dismissable), unlike
ConfirmDialog's AlertDialog. Controlled-only (`open`/`onOpenChange` required by the props type),
titled header with an X close button.

Audit:

- Base UI wires `aria-labelledby` to `Dialog.Title` automatically; a `Description` is not rendered
  here (callers put content in `children`) — fine, the SPEC only asks for a titled header.
- The close button: `BaseDialog.Close` with `aria-label="Close"` and an aria-hidden icon —
  accessible name present. It carries `outline-none` with no `focus-visible` ring, a small
  deviation from the ui/SPEC.md "one keyboard focus ring" manner (every other control gets the
  ring). Cosmetic/a11y-polish; noted, not reported as a bug since no spec sentence pins the ring
  to this control.
- z-index 50 on both Backdrop and Popup, same layer family as sheets/menus; the popup renders
  after the backdrop so it paints above. Correct.
- No busy-guard here (unlike ConfirmDialog) — by design: "abandoning a half-filled form costs
  nothing".

## Functions (low-level)

- `Dialog({ open, onOpenChange, title, children })` — thin composition; no state of its own, so
  no lifecycle/race concerns. Portal-rendered, so it escapes any overflow-hidden ancestor.
  Verdict: correct.

## Bugs found

None found.
