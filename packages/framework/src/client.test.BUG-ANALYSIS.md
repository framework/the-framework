# Bug analysis: packages/framework/src/client.test.ts

## Business logic (high-level)

One test enforcing the client barrel's whole contract (#431/#520): nothing reachable from
`client.js` may import `node:*`. It walks the real, *compiled* import graph (the test file runs
from the build output directory, so `join(OUT, 'client.js')` is the shipped artifact) rather than
the source — deliberately, because `import type` erases at compile time and a source walk would
report type-only edges as false leaks. The test can genuinely fail: adding a runtime `node:` edge
anywhere in the reachable graph makes `leaks` non-empty and the message names each offending edge.

Verified empirically: re-running the same walk over `dist/client.js` finds 26 modules, no `node:`
imports, and zero bare (non-relative) imports.

Edge cases and limitations weighed:

- **Bare package specifiers are not followed** (`else if (spec.startsWith('.'))` — anything else
  is ignored). An npm dependency that itself uses Node built-ins would slip past. Today the
  reachable graph has zero bare imports at all, so the guard is currently airtight; this is a
  latent blind spot, not a present bug.
- **Un-prefixed builtins** (`'fs'` instead of `'node:fs'`) would not be flagged. The codebase
  consistently uses the `node:` prefix and TS/eslint conventions keep it that way; no occurrence
  in the compiled graph.
- **Regex false positives**: `/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/` also matches inside
  string literals or comments containing e.g. `from 'x'`. In compiled output comments are mostly
  preserved by tsc, so prose in a doc comment could in principle add a phantom relative edge; a
  phantom edge to a nonexistent file would crash `readFile` and fail the test loudly (a false
  failure, not a false pass). The failure direction is safe. No such phantom exists in today's
  output (walk completes).
- **Dynamic `import(expr)`** with a non-literal specifier would be missed — none exist in the
  reachable graph.

## Functions (low-level)

- **`nodeImportsReachableFrom(entry)`** — BFS/DFS over relative edges with a `seen` set (cycles
  safe), collecting `node:` specifiers as `<relative file> -> <spec>` strings. Uses
  `resolve(dirname(file), spec)`; compiled ESM always writes explicit `./x.js` specifiers, so the
  resolution is exact. `queue.pop()` makes it DFS — order irrelevant to the assertion. An
  unreadable file rejects `readFile` and fails the test rather than passing silently. Verdict:
  correct.
- **the test** — asserts `deepEqual(leaks, [])` with a message listing the leaks. Fails when it
  should; cannot pass vacuously (if `client.js` itself were missing, `readFile` rejects).
  Verdict: correct.

## Bugs found

None found.
