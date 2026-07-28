The write-side twin of `use-async`'s read hooks: `useAction()` gives every mutation panel one `{busy, error, reset, run}` instead of a hand-rolled busy/error/finally scaffold.

## TLDR

- `run(fn, fallback?)`: flips busy, clears error, awaits the RPC; a `{ok:false, error?}` result (the telefunc mutation failure branch) or a thrown error lands in `error` (fallback when no message) and resolves `undefined`; success resolves the result so the caller does only its success side.
- Void results are not failures (`isFailure` checks `ok === false` specifically).
- Default fallback message: `'Something went wrong.'`.
