# Bug analysis: packages/framework/src/prompt-template.ts

## Business logic (high-level)

The `${{ ... }}` template layer (#350): each fragment is a real JS expression evaluated via `new Function` against named context values; text outside fragments passes through byte-identical; a fragment that throws or yields `undefined` aborts the render with a `TemplateFragmentError` naming the fragment. Checked against `prompt-template.SPEC.md`:

- **Prompts adapt** — `template.replace(FRAGMENT, fn)`: replacement in place, `String(result)` conversion. Using a *function* replacer is load-bearing twice: (a) `$&`-style patterns in the evaluated value stay literal (pinned by a test; a string second argument would mangle them), and (b) `String.replace` never re-scans inserted text (probed), so a value containing `${{ ... }}` cannot cause second-order evaluation — important given fragments are arbitrary code execution.
- **Broken fragment stops the render** — both failure modes throw with the fragment text preserved (`err.fragment`) and the cause stringified via `errorMessage`. The throw propagates out of `replace` and out of `renderTemplate` — intended (SPEC: "aborts rendering").
- **Trusted templates only** — enforced socially (doc comment + SPEC), not technically; call sites render only shipped prompts (`preset-prompt.ts` passes user text as context data, never as template). Verified for this batch's callers.
- **Adjacent `}}` rule** — `FRAGMENT = /\$\{\{([\s\S]*?)\}\}/g` non-greedy: `{a:{b:1}}` ends the fragment at the inner `}}`, evaluating something other than what was written. Explicitly documented as a permanent language rule (SPEC has a whole section; the test pins it), so not a bug by definition here.

Edge cases:

- Context keys become `new Function` parameter names — a key that is not a valid identifier (or a reserved word) makes `new Function` itself throw, which lands in the per-fragment catch and reports "failed to evaluate": slightly misleading wording but safe. All real contexts use `tf`.
- `'use strict'` inside the function: prevents accidental global writes and makes `undefined` typos throw where they otherwise silently resolve — good.
- `result === undefined` → typo guard; `null` is allowed and renders `"null"` — a template author writing `${{ tf.x ?? null }}` would ship the word "null"; their responsibility, and `undefined` (the common typo shape) is what's guarded. Reasonable line.
- `String(result)` is safe for symbols (`String(sym)` does not throw, unlike interpolation) and objects (`[object Object]` — visible in the prompt, caught in review).
- Multiple fragments: `replace` with `/g` handles all; state-free (`FRAGMENT.lastIndex` is managed by `replace` internally, and no other method that leaks `lastIndex` is used on this shared regex — safe to share across calls).
- An unterminated fragment (`${{ x` with no `}}`) simply does not match and passes through as literal text — silently degraded prompt rather than an error. Consistent with "text outside fragments passes through"; the truncated-prompt failure the SPEC worries about is the *early*-close case, which is documented. Noted as a residual authoring hazard, not a bug (the tests/SPEC treat non-matching text as pass-through).

## Functions (low-level)

- **`FRAGMENT`** — non-greedy, `[\s\S]` so fragments can span lines. Correct per the documented language rule.
- **`TemplateFragmentError`** — carries `fragment`; message format `[framework] template fragment ${{...}} ...`. Correct.
- **`renderTemplate(template, context)`** — names/values extracted once; per-fragment try/catch; undefined guard; function replacer. Verdict: correct.

## Bugs found

None found.
