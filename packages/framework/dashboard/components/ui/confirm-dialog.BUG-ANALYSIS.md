# Bug analysis: packages/framework/dashboard/components/ui/confirm-dialog.tsx

## Business logic (high-level)

The confirm-before-irreversible-action dialog (confirm-dialog.SPEC.md), on Base UI's AlertDialog
(focus-trapped, no light dismiss — the deliberate-confirmation guarantee). Checked against the
SPEC:

- **Waits for the action, reports failure in place**: `confirm()` runs `onConfirm` through
  `useAction`; while `busy` both buttons are disabled and `onOpenChange` refuses to close
  (`if (busy) return`), so neither Cancel, Escape nor programmatic close can interrupt an
  in-flight action. A thrown error or `{ ok: false, error }` result sets `error`, rendered inside
  the dialog. Matches the SPEC — with one contract wrinkle (bug 1).
- **Success closes first, then hands back**: `setOpen(false)` then `queueMicrotask(onSuccess)`.
  React 18 schedules the state flush on a microtask enqueued *before* this `queueMicrotask` (the
  `setOpen` happens earlier in the same `.then` continuation), so the close commit precedes
  `onSuccess` — the navigate-away-safely promise holds.
- **Reopening clears a previous error**: `onOpenChange(next)` calls `reset()` when `next` is true.
  Correct for trigger-opened dialogs. For a *controlled* dialog the caller flips `open` itself;
  Base UI still fires `onOpenChange` for user-initiated opens via the Trigger, but a caller
  setting `open={true}` directly bypasses this handler — a stale error from a previous failed
  attempt would still show. All current controlled callers (AgentActionsMenu) mount the dialog
  per-open or reopen through the same flow; noted as a reliance, not reported.
- **Controlled/uncontrolled**: `open = controlledOpen ?? uncontrolledOpen`,
  `setOpen = onOpenChange ?? setUncontrolledOpen`. A caller passing `open` without `onOpenChange`
  would freeze the dialog (setUncontrolledOpen writes state the render ignores); no caller does.

## Functions (low-level)

- `confirm()` — `void run(onConfirm, fallbackError).then(result => { if (result === undefined)
  return; setOpen(false); queueMicrotask(onSuccess) })`. `run` never rejects (it catches), so the
  `void` chain cannot produce an unhandled rejection. Verdict: see bug 1.
- `ConfirmDialog` component — renders Trigger only when given (menu-driven callers drive `open`
  themselves), Backdrop, centered Popup, Title/Description, error line, Cancel (AlertDialog.Close
  wrapping a Button) and the confirm Button (destructive by default, busy label + cursor).
  Verdict: correct.

## Bugs found

1. `L52`: **An `onConfirm` that resolves with a falsy non-`{ok:false}` value (e.g. `Promise<void>`)
   leaves the dialog open with *no* error shown.** `useAction.run` treats a void/`undefined`
   resolution as success and returns it — but this component uses `result === undefined` as its
   failure signal, so such a "success" is misread as failure while `error` stays null: buttons
   re-enable and the dialog just sits there, silently. That contradicts the component's own JSDoc
   ("returning a falsy/thrown result keeps the dialog open *with the error*") and the SPEC's
   "nothing fails silently". Today the only caller (AgentActionsMenu L274) returns the RPC result
   or rejects, so the path is latent — reported low-confidence because the contract documented on
   `onConfirm: () => Promise<unknown>` invites exactly this caller shape. Severity: minor,
   confidence: low. Fix sketch: have `run` signal failure out-of-band (e.g. return a
   `{ ok: boolean }` wrapper or check `error` state after), or require `onConfirm` to resolve
   truthy and say so in the type (`Promise<{}>`), or treat `undefined` as success here and rely on
   `useAction`'s error state to decide whether to close.

