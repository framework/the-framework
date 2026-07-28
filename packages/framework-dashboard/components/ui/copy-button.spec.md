Small copy-to-clipboard icon button (#948) for strings users take to a terminal (branch names, session ids, URLs), flashing a check so the click visibly landed.

## Facts

- On copy, the icon swaps to `Check` (success tone) and the tooltip reads "Copied" for 1.5s; the timeout is stored in a ref, cleared on re-click and on unmount.
- Uses `navigator.clipboard?.writeText` (optional-chained: no-op where the Clipboard API is absent) and this directory's `Tooltip` with `render=` on the trigger.
