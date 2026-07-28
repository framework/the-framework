Confirm-before-you-act dialog on Base UI's AlertDialog (#1032) for irreversible actions: confirming runs `onConfirm` through `useAction`, showing busy/error in place and staying open until success.

## TLDR

- Renders trigger (optional) + portal'd backdrop + centered popup with title, body, error line, Cancel, and a confirm `Button` (`destructive` variant by default, `default` when `destructive={false}`).
- Open state is controlled (`open`/`onOpenChange`) or uncontrolled (internal state via the `trigger`).
- `onConfirm` failure (thrown, or a `{ ok: false }` result — `useAction` returns `undefined`) keeps the dialog open with the error text; success closes it, then fires `onSuccess`.

## Decisions

- AlertDialog rather than Dialog on purpose: it traps focus and has no light-dismiss, so a destructive confirm is a deliberate choice, not a stray click past the edge.
- `trigger` is optional because a menu item can't be the trigger — the menu closes on click — so those callers drive `open` themselves.
- `onSuccess` fires in a `queueMicrotask` after the close, so a caller that unmounts the dialog (e.g. navigating off a deleted session) doesn't tear it down mid-transition.

## Facts

- `onOpenChange` is intercepted: the dialog can never close while the action is in flight (`busy`), and a prior error is `reset()` on reopen.
- Busy state swaps the confirm label for `confirmBusyLabel` (default `'Working…'`) and sets `cursor-progress`.
