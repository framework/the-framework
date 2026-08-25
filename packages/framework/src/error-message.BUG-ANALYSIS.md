# Bug analysis: packages/framework/src/error-message.ts

## Business logic (high-level)

A single one-line helper that normalizes a caught `unknown` into a human-readable string, so every
surface (terminal, dashboard, RPC error payloads, driver turn failures) words a failure the same
way. Per `error-message.SPEC.md`: "a real error's message, anything else stringified". It exists to
de-duplicate an idiom that was spelled out at twenty-plus call sites, where one site drifting (a
dropped `String()`) would be a silent defect.

Deliberately Node-free so it can be re-exported through `/client` to the dashboard bundle — no
imports at all, which is what keeps that true.

**Invariants.** Total function: for every input it either returns a string or propagates whatever
the input's own stringification throws. It never returns `undefined`, never returns a non-string,
and never inspects `err.stack` or `err.cause` — the caller decides how much detail to show. It is
pure and stateless, so there are no concurrency, ordering, or lifecycle concerns.

**Edge cases, and whether they matter here.**

- `undefined` / `null` → `"undefined"` / `"null"`. Ugly but honest; both are reachable only from a
  `throw undefined`, which nothing in this codebase does.
- A thrown string → itself, which is the case the JSDoc calls out as the reason `String()` must not
  be dropped.
- A plain object → `"[object Object]"`. Information-poor, but the alternative (`JSON.stringify`)
  throws on cycles and on BigInt, so the simple form is the safer default for a helper used in
  error paths.
- A `Symbol` → `String(sym)` is explicitly permitted by the spec (unlike a template literal, which
  throws), so `"Symbol(x)"` comes back rather than a `TypeError`.
- `Object.create(null)` or an object with a throwing `toString` → `String()` throws, i.e. an error
  handler that itself throws. Unreachable in this system: nothing constructs null-prototype objects
  to throw, and adding a `try/catch` would be exactly the kind of defensive code for
  provably-absent input the project rejects.
- A cross-realm `Error` (from a `vm` context or a worker) fails `instanceof` and falls to
  `String(err)`, which yields `"Error: <message>"` — still readable, just prefixed. No such realm
  boundary exists in this package.
- `AggregateError` → its own `.message` only; the individual `errors` are dropped. That matches the
  "one line for a surface" contract.

## Functions (low-level)

- **`errorMessage(err: unknown): string`** — the only export. Input: any caught value. Output: the
  `Error`'s `message`, else `String(err)`. Analyzed exhaustively above; the `instanceof` branch and
  the fallback together cover every JS value except the two throwing-stringification cases, neither
  of which this system produces. Verdict: correct.

## Bugs found

None found.
