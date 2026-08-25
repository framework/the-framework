# Bug analysis: packages/framework/src/discord-credentials-store.ts

## Business logic (high-level)

The registry-backed half of the Discord credential (#1095): the `DiscordCredentialsStore` the daemon
wires into the dashboard context. Split from `discord-credentials.ts` purely so the `node:*` edge
(via `registry.js` → the home file) stays unreachable from the browser bundle — `client.test.ts`
walks the import graph and would fail on it.

Responsibilities and the invariants that matter:

1. **Status out, never values.** `status()` reads the registry's secrets and reduces them through
   `discordCredentialStatus` to `{webhook?: 'env'|'stored'}`. A failed/absent registry read is
   swallowed into `{}` ("nothing configured"), which is right for a dashboard panel — though
   `readSecrets` → `readRegistry` already never rejects, so the `.catch` is belt-and-braces.
2. **Env-owned credentials are not editable here.** Writing a value the next read would shadow is
   worse than refusing, so a patch touching a credential whose env var is set (non-blank) is refused
   naming the variable. The blank-env check (`?.trim()`) matches the resolver's precedence exactly:
   an env var set to spaces does *not* lock the dashboard out of a credential it isn't actually
   shadowing.
3. **All-or-nothing validation.** Every credential in the patch is checked (env ownership, then
   `validateCredential`) *before* `writeSecrets` is called even once, so a refusal leaves the
   registry byte-identical. `null` skips validation — clearing is always legal.
4. **A patch that carries nothing is a success that touches nothing** — the `Object.keys(write)
   .length === 0` early return, which also means `onChange` is not fired for a no-op save (the
   daemon is not rebuilt for a change that did not happen). Matches the SPEC.
5. **The rebuild happens after the write, and cannot fail the save.** Ordering: `await
   writeSecrets(...)` then `onChange`, so the reload can never read the value it is replacing. The
   `Promise.resolve().then(() => opts.onChange?.())` shape is load-bearing and correctly reasoned in
   the comment: `Promise.resolve(onChange())` would evaluate `onChange()` while building the
   argument, so a *synchronous* throw would escape the `.catch` and turn a landed save into a
   reported failure. As written, both sync throws and rejected promises are swallowed. The `await`
   on that chain means `save` resolves only after the reload settles — a slow reload delays the
   dashboard's response but cannot corrupt anything.

Concurrency: two dashboard saves can interleave between `readSecrets` and `writeSecrets`, but
`writeSecrets` itself is `serialize`d in `registry.ts` and is a read-modify-write *patch* over the
whole registry, so the last writer wins per key and no unrelated field (projects, preferences,
daemon token) is lost. That is the intended shape for a single-user settings panel.

Failure modes checked: a `writeSecrets` rejection (unwritable home, ENOSPC) returns
`{ok:false, error:'failed to save'}` — the underlying reason is dropped, so the dashboard shows a
generic error; deliberate-looking (no secret can leak through the message) and consistent with the
presence-only contract. A partially applied write is impossible because `writeSecrets` writes to a
temp file and renames.

## Functions (low-level)

- **`registryDiscordCredentialsStore(opts)` (L21)** — captures `env` (default `process.env`) and
  `fs` (left `undefined` so `registry.ts`'s own default applies) once at construction. `env` being
  snapshotted at construction means an env var set *after* the daemon built the store is not seen;
  nothing mutates `process.env` at runtime in this system, and `process.env` itself is a live object
  when the default is used. Correct.
- **`status()` (L29)** — `readSecrets(fs, env).catch(() => ({}))` then `discordCredentialStatus`.
  With `DISCORD_WEBHOOK` set it reports `'env'` even when the file has nothing, which is what lets
  the UI say who owns the value. Correct.
- **`save(patch)` (L32)** — the loop's three arms:
  - `value === undefined` → skip (leave alone).
  - env var non-blank → refuse, naming the variable, **before** anything is written. Note this
    refuses *clearing* too (`{webhook: null}` with `DISCORD_WEBHOOK` set): the stored value is
    unreachable from the dashboard while the env var is present. That is what the SPEC says
    ("Such a save is refused"), and the stale stored value is shadowed anyway, so it is behavior
    rather than a defect — recorded here because it is the one asymmetry with "clearing is always
    allowed".
  - `null` → no validation; string → `validateCredential`, first failure refuses the whole save.
  Blank strings reach `write` un-refused and `writeSecrets` turns them into a delete, so a
  whitespace-only paste clears rather than storing junk — consistent with `validateCredential`
  treating blank as "clearing".
  The value is written untrimmed; `writeSecrets` trims and `resolveDiscordCredentials` trims again,
  so a trailing newline can never reach the notifier. Correct.
- **The `onChange` invocation (L54-56)** — analyzed above; the swallow is intentional and scoped to
  the reload only (the write's own failure is reported). Correct.

## Bugs found

None found.
