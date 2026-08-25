# Bug analysis: packages/framework/src/preset-prompt.test.ts

## Business logic (high-level)

Pins the #874 behavior exactly as `preset-prompt.test.SPEC.md` describes:

1. `DEFAULT_WHAT` is a template (`^\$\{\{`), the declared param carries it verbatim as its default, and a render leaves no unrendered `${{` behind — the regression guard for the default that once reached the prompt as literal text.
2. The default resolves to the session name when a session exists (`{ session_name: 'fix-login' }` → "Work on fix-login."), to "entire codebase" otherwise (both `render()` and `render(undefined, {})`), an explicit target wins and is trimmed, and a whitespace-only target falls back.

The tests exercise a locally defined demo preset rather than a catalog one, which keeps them independent of prompt-file wording — appropriate, since the unit is `definePreset`, not the catalog.

Do the tests verify what they claim? Yes: each assertion compares full rendered strings, so a broken fallback, missing trim, or unevaluated default would fail. All calls are synchronous; nothing needs awaiting.

## Functions (low-level)

- **`preset` (module const)** — `definePreset` with a one-fragment template `Work on ${{ tf.params.what }}.`. Fine.
- **Test 1** — `assert.match(DEFAULT_WHAT, /^\$\{\{/)`, `preset.params[0]!.default === DEFAULT_WHAT`, and `render().includes('${{') === false`. The non-null `params[0]!` is safe (param-ful preset). Cannot pass vacuously. Correct.
- **Test 2** — five renders covering no-session, empty ctx, session, explicit trimmed target, blank target. Correct.

Minor observation (not a bug): line 4 imports `presetFilePath` from `./preset-registry.js` and never uses it. `tsconfig.base.json` has no `noUnusedLocals`, so it compiles; dead import only.

## Bugs found

None found.
