# Bug analysis: packages/framework/src/prompt-template.test.ts

## Business logic (high-level)

Covers every clause of `prompt-template.test.SPEC.md`:

1. Byte-identical pass-through, deliberately including a lone `${single-brace}` and bare `$` — the inputs most likely to trip a sloppier scanner.
2. Simple substitution; several fragments in one template (including an arithmetic one, proving real evaluation rather than lookup); non-string results stringified (number, boolean).
3. The autopilot ternary rendered for on / off / absent — pinning "absent = off", which is the semantics the built-in system prompt relies on.
4. Replacement-pattern literalness: evaluated value `'give me $& and $1'` must survive — this is the regression a string-replacer refactor would introduce, and the test would catch it.
5. Failure modes: invalid JS → `TemplateFragmentError`; `undefined` result → error with `err.fragment === 'tf.promt'` (the predicate form checks both the class and the captured fragment — cannot pass on a generic throw); the error message names the fragment (`/nope\(/`).
6. The adjacent-`}}` rule pinned in both directions: `JSON.stringify({a:{b:1}})` throws (early close), and the same expression with one space (`{b:1} }`) renders `{"a":{"b":1}}` — documenting both the rule and its fix, exactly as the SPEC prescribes.

Do the tests actually verify their claims? Yes. Each uses strict `assert.equal`/`assert.throws` with concrete expectations. The `assert.throws` calls use either the class or a predicate — none is the footgun form `assert.throws(fn, 'message')` (a string second arg is treated as the assertion message and matches any throw); the one place a message string appears (test 9's try/catch) manually fails on non-throw first. Everything is synchronous, so no missing awaits.

Small observations (not bugs):

- Test 9 (`renderTemplate('${{ nope( }}', {})`) relies on `nope(` being a syntax error inside `new Function` — stable across engines.
- The undefined-typo test's predicate returns a boolean; `assert.throws` treats a falsy predicate result as failure — correct usage.
- Coverage is honest about the unterminated-fragment case being unspecified (no test) — consistent with the SPEC, which only legislates the early-close case.

## Functions (low-level)

No helpers; nine flat `test` blocks, each self-contained with literal inputs. All assertions reachable and falsifiable.

## Bugs found

None found.
