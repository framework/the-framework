# Bug analysis: packages/framework/src/layout.test.ts

## Business logic (high-level)

Pins the four behaviors of the layout gate: unmarked-repo passes, matching marker passes, mismatch refuses with both sides + fix named, and — the load-bearing one — the *checked-in* marker equals this build's derivation (the lockstep test that fails a rename PR until `.the-framework/LAYOUT` is regenerated). Plus a shape test that every marker line is pure `name: value` data.

Verification of the tests' honesty:

- `markerFs(content?)` fakes only the two calls `checkLayout` makes (`exists`, `read`); `read` throws ENOENT when absent, so if `checkLayout` ever read without checking existence the first test would surface it as a rejection (the test would fail via the rejected promise — all tests properly `await`). Good.
- The mismatch test derives the "recorded" side by string-replacing `archive-dir: agents` → `sessions` in the live marker. If `ARCHIVE_DIR` were ever renamed away from `agents`, `replace` would silently no-op and the test would assert `result.ok === false` on two *equal* markers — failing loudly at `assert.equal(result.ok, false)`. So the test cannot silently rot. The regex asserts cover the file path, both sides, the issue number, and the word "update" (the fix). Falsifiable.
- The shape test regex `/^[a-z-]+: \S+$/` would catch a comment line or an empty value sneaking into the marker; `trimEnd()` excludes the deliberate final blank. Also pins `layoutMarkerPath`.
- The lockstep test resolves `../../../.the-framework/LAYOUT` from `import.meta.url`. From `packages/framework/src/` three `..` reach the repo root — correct; and since a build output at `packages/framework/dist/` sits at the same depth, the test still finds the marker if run from compiled output. The `try/catch → return` makes it a silent skip outside a repo checkout (an installed package), which is the documented intent; inside this repo the file exists (verified), so the test genuinely runs here.
- `if (result.ok) return` after `assert.equal(result.ok, false)` is unreachable-but-typesafe narrowing, not a swallowed assertion (the equal already failed the test).

## Functions (low-level)

- **`markerFs(content?)`** — minimal `StoreFs` stub; `write`/`append`/`mkdir` are inert no-ops and `readdir` returns `[]`, none of which `checkLayout` calls, so the stub cannot mask behavior. Correct.
- **ungated test / matching test** — `deepEqual` against `{ok: true}` (exact shape, would catch an extra field). Correct.
- **mismatch test (#1575)** — described above. Correct.
- **derivation-shape test** — described above. Correct.
- **lockstep test (#1575)** — described above; the one test in the suite whose skip path is silent, an accepted tradeoff documented in-line. Correct.

## Bugs found

None found.
