# Bug analysis: packages/framework/src/discord-credentials.ts

## Business logic (high-level)

The browser-safe *rules* half of the Discord credential (#1095): where the notifications webhook
comes from, which source wins, what may be told to the dashboard, and what counts as a valid value.
It holds no credential and touches no `node:*` module on purpose — `client.test.ts` walks the import
graph, so the home-file edge lives in `discord-credentials-store.ts` instead, and this file can be
imported by the dashboard bundle so browser-side validation and daemon-side enforcement are literally
the same function.

Invariants it is responsible for:

- **Two sources, env wins.** `DISCORD_WEBHOOK` beats `secrets.discordWebhook`; blank (whitespace-only)
  counts as absent on *both* sides, which is what stops an empty env var in a container from
  shadowing a stored value into "Discord is off".
- **Presence, never the value.** `DiscordCredentialStatus` is `{webhook?: 'env' | 'stored'}` — no
  field of it can be turned back into the credential. `resolveDiscordCredentials` (the value-bearing
  twin) is daemon-only by convention; nothing here stops a caller from shipping it to the browser,
  but no caller does.
- **Shallow validation.** URL-parses and requires http/https, deliberately not discord.com — the
  SPEC's rationale is user-fronted proxies. Blank is always legal because that is the Clear button.
- **Key tables, once.** `ENV_KEYS` / `SECRET_KEYS` / `CREDENTIALS` are derived from each other, so a
  second credential added to `ENV_KEYS` is automatically covered by every loop.
  `SECRET_KEYS satisfies Record<keyof DiscordCredentials, keyof RegistrySecrets>` makes a rename in
  `registry.ts` a compile error rather than a silent no-op read.

Lifecycle: pure functions, no state, no I/O, no ordering concerns. Everything that can go wrong here
is a wrong answer, not a race.

## Functions (low-level)

- **`ENV_KEYS` / `SECRET_KEYS` / `CREDENTIALS` (L49-58)** — `CREDENTIALS` is `Object.keys(ENV_KEYS)`
  cast to `Array<keyof DiscordCredentials>`; the cast is sound only because `ENV_KEYS` covers every
  credential. `ENV_KEYS` has no `satisfies` clause of its own (unlike `SECRET_KEYS`), so a credential
  added to `DiscordCredentials` but forgotten in `ENV_KEYS` would compile and silently drop out of
  every loop. One credential exists; recorded as a reliance, not a defect. Correct.
- **`credentialEnvVar(credential)` (L61)** — total over the key union. Correct.
- **`resolveDiscordCredentials(env, secrets)` (L66)** — `env[...]?.trim() || secrets[...]?.trim()`.
  The `||` (not `??`) is what makes a blank env var fall through to the stored value; a blank stored
  value then yields `''`, which the `if (value)` guard drops, so a whitespace-only credential in the
  file reads as absent rather than as an empty webhook URL the notifier would try to POST to. Both
  sides are trimmed before use, so a pasted trailing newline in either source cannot produce a URL
  with a newline in it. Correct.
- **`discordCredentialStatus(env, secrets)` (L76)** — same precedence expressed as origin. `env`
  checked first, `stored` second, absent otherwise; blank on both sides is absent, matching
  `resolveDiscordCredentials` exactly — the two cannot disagree about whether Discord is configured,
  which is the property that matters (a status saying "stored" while the resolver returns nothing
  would show the dashboard a configured Discord that never posts). Returns a fresh object, no
  aliasing of the inputs. Correct.
- **`validateCredential(credential, value)` (L93)** — trims, blank → legal (clear), `new URL()` →
  "That is not a URL.", non-http(s) protocol → "A webhook URL must be http or https.". The
  `credential` parameter is **unused**: every credential validates as a webhook URL. With one
  credential in the table that is dead symmetry rather than a defect, but adding a second credential
  (a bot token, which #1095's comment still mentions) would silently validate it as a URL. Recorded;
  not reachable today. Edge cases checked: `new URL('http:x')` parses with protocol `http:` and is
  accepted — a degenerate but genuinely http URL; `javascript:...`, `ftp://...`, `file://...` are
  refused by the protocol check; a URL longer than 500 chars passes here but is silently truncated
  by `registry.ts`'s `sanitizeSecrets` cap on the way into the file (see below). Correct.
- **Types (`DiscordCredentials`, `CredentialSource`, `DiscordCredentialStatus`,
  `DiscordCredentialsPatch`, `SaveCredentialsResult`, `DiscordCredentialsStore`)** — the patch's
  `string | null | undefined` triple is what lets "leave alone" and "clear" be distinguished by the
  store; `DiscordCredentialsStore` being optional in the dashboard context is what makes the relay
  degrade to "nothing configured, writes refused". Correct.

### Recorded, not reported

`MAX_SECRET_LENGTH = 500` in `registry.ts`: `sanitizeSecrets` *truncates* rather than rejects, so a
webhook longer than 500 characters would be stored corrupted while `save` reports `{ok: true}` and
the status reports `stored`. Validation here does not bound the length, so nothing refuses it first.
Real Discord webhooks are ~120 characters and no caller produces one near the cap, so this is a
reliance on input size rather than a live defect.

## Bugs found

None found.
