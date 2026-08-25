# Bug analysis: packages/framework/src/discord-credentials.test.ts

## Business logic (high-level)

Covers both halves of #1095 in one file: the pure rules (`discord-credentials.ts`) and the
registry-backed store (`discord-credentials-store.ts`). The store tests run against a real
`registry.ts` — only the filesystem is faked — so they exercise the actual JSON shape, the
temp-file+rename write path and `sanitizeSecrets`, not a mock of them. That is the right depth here:
the bugs this module could plausibly have (a value written under the wrong key, a value that reads
back as absent, a write that happens despite a refusal) all live in that seam.

What is pinned, and whether the assertions really pin it:

- **Precedence** (3 tests): env beats stored; stored used when env is unset; a *blank* env var does
  not shadow. The blank-env test is the one that would catch a `??`-instead-of-`||` regression in
  `resolveDiscordCredentials`, and it is asserted on the resolved value, so it cannot pass
  vacuously.
- **Presence-only contract**: `deepEqual(status, {webhook:'stored'})` plus a
  `JSON.stringify(status).includes('https://stored') === false` assertion. The `deepEqual` alone
  already forbids extra fields, so the stringify check is redundant — but it is the assertion that
  states the *intent* (nothing here can be turned back into the credential), and it would also catch
  a non-enumerable or nested leak that `deepEqual` compares loosely. Fine.
- **Validation**: accepts a discord.com webhook and a `http://localhost:9000/hook` proxy (the SPEC's
  "not tied to discord.com" clause), refuses a non-URL and an `ftp:` URL *by message* (`assert.match`
  on the reason, so swapping the two error strings fails), and accepts blank as clearing.
- **Store**: save → `status()` reads back `'stored'` (a round trip through the real registry
  writer/reader, so a wrong `SECRET_KEYS` mapping fails it); reload ordering; reload throwing;
  env-owned refusal *with* "nothing was written"; invalid refusal *with* "nothing was written";
  clearing; env-set credential reads as `'env'`.

Coverage gaps (recorded, not defects): nothing asserts that `onChange` is **not** called when a save
is refused or when the patch is empty — the "the daemon is not rebuilt for a change that did not
happen" half of the contract is unpinned. Nothing covers a `writeSecrets` failure producing
`{ok:false, error:'failed to save'}` (the mem-fs never fails), and nothing covers a save that leaves
the registry's other fields (projects, preferences, `daemonToken`) intact — the patch-not-overwrite
property is `registry.ts`'s to test, and it does.

## Functions (low-level)

- **`ENV` / `FILE` (L16-17)** — `registryPath({HOME:'/home/u'})` is computed once from the same env
  the stores are given, so the fake file path and the code under test cannot disagree. No real HOME
  is read and no real file is touched: the suite is hermetic and parallel-safe.
- **`memFs(seed)` (L20)** — the minimal `RegistryFs`: `read` rejects for a missing path (which is
  what `readRegistry` expects for "no registry yet"), `write`/`rename` model the atomic write, and
  `mkdir`/`chmod` are no-ops. Exposing `files` is what lets the ordering test inspect the file from
  inside `onChange`. Because `rename` is provided, the tests take the atomic path — the same path
  production takes. Correct.
- **`stored(secrets)` (L42)** — a seeded registry file with the real shape (`projects`,
  `preferences`, `secrets`), so `readRegistry`'s sanitizers see valid input. Correct.
- **Precedence tests (L46-59)** — direct assertions on the resolver's output. Correct.
- **Status tests (L61-71)** — see above. Correct.
- **Validation test (L73-83)** — `?? ''` before `assert.match` means an *unexpected* `undefined`
  (validation wrongly accepting) fails the match rather than throwing on `undefined`, so the failure
  message is legible. Correct.
- **`credentialEnvVar` test (L85)** — pins the literal `DISCORD_WEBHOOK` the UI copy quotes. Correct.
- **Save round trip (L89-96)** — asserts `{}` before, `{ok:true}` on save, `{webhook:'stored'}`
  after. The pre-assertion is what makes the post-assertion meaningful. Correct.
- **Ordering test (L98-112)** — `onChange` records whether the file *already* contains the new value.
  Worth checking that this cannot pass by accident: if `onChange` ran before the write, `fs.files
  .get(FILE)` would be `undefined` and the `!` non-null assertion would throw a `TypeError` inside
  `onChange`, which `save`'s `.catch(() => {})` swallows — `seen` would then be `[]` and the
  `deepEqual(seen, ['after-write'])` still fails. So both failure shapes (wrong order, or not called
  at all) are caught. Correct.
- **Reload-throws test (L114-126)** — asserts both the `{ok:true}` result *and* that the credential
  is readable afterwards, so a regression that reported success while rolling the write back would
  fail. Correct.
- **Env-refusal test (L128-137)** — matches the error text and asserts `fs.files.has(FILE) === false`.
  The file-absence assertion is the strong half: it is what pins "nothing is written until every part
  of the save is valid". Correct.
- **Invalid-refusal test (L139-146)** — same shape, without matching the message (the message itself
  is covered by the validation test). Correct.
- **Clear test (L148-154)** — seeds a stored webhook, saves `null`, asserts the status is empty. Goes
  through `writeSecrets`' delete-then-`sanitizeSecrets` path, so it also pins that clearing the last
  credential drops the `secrets` key rather than leaving `{}` behind. Correct.
- **Env-status test (L156-158)** — `'env'` with an empty file. Correct.

## Bugs found

None found.
