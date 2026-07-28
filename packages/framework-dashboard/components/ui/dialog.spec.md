shadcn "base" dialog on Base UI (not Radix) — a centered modal shell with title bar and X close, for small forms (#1025).

## Decisions

- Plain Dialog, unlike `ConfirmDialog`'s AlertDialog: Esc and backdrop click close it, since a half-filled form is not a commit to defend against.
- Controlled-only (`open`/`onOpenChange` required) — the host owns when it shows; there is no trigger slot.
