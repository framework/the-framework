# Bug analysis: packages/framework/src/dashboard-rpc/preferences.ts

## Business logic (high-level)

The Settings surface: eight exported RPCs over four stores — the user's preferences (registry), a
project's shared presets (the repo's own `.the-framework/`), the editors installed on this machine,
and the daemon's Discord credentials. Every function here is a thin adapter; the rules live in the
stores it calls. Its own responsibilities, per `preferences.SPEC.md`:

- **Failure is an answer, not a rejection.** Every write returns a typed `{ok:false, error}` instead
  of throwing, so the dashboard renders the failure rather than losing the save to an exception it
  cannot read. Both writes (`savePreferences`, `patchPreferences`) and both project-preset paths do
  this; `saveDiscordCredentials` does it via `.catch`.
- **Reads degrade to empty.** `onPreferences` answers `{}`, `onProjectPresets` answers `[]`,
  `onEditors` answers `[]`, `onNotifyChannels` answers `{}` sources — never an error the Settings
  page has to render as a broken panel.
- **Partial writes merge (#1148).** `patchPreferences` delegates to the store's `patch` and returns
  the *stored* result, which is what lets a stale tab adopt the truth it just wrote against instead
  of overwriting another tab's change. `savePreferences` keeps whole-block replacement for the
  callers that genuinely own the whole block.
- **Presence, never values.** `onNotifyChannels` reports which credential exists and where it came
  from; there is no read that can return a credential to a browser. `saveDiscordCredentials` is
  write-only by construction.

**Two-tier presets.** The user tier lives inside `Preferences` in the registry (so it is covered by
`onPreferences`/`savePreferences`); the project tier is resolved through the project id to the
repo's checkout, so an unknown project reads `[]` and refuses the write. That asymmetry —
`onProjectPresets` returns `[]` for an unknown project while `saveProjectPresets` returns
`{ok:false,'unknown project'}` — is deliberate and matches the SPEC ("An unknown project has no
project presets to read, and saving to one is refused").

**Concurrency.** Two tabs patching at once is exactly what `patch` exists for; serialization is the
registry's (`registry.ts` `serialize()`), not this module's. A full `savePreferences` from a stale
tab can still clobber — also by design, since the SPEC assigns that role to the partial write.

**Unwired context.** Every accessor used here except none goes through `fromContext`, which throws.
That is the D3 stance ("one host wires all of it"). Worth noting the drift it leaves behind: the
`DiscordCredentialsStore` doc in `discord-credentials.ts` L106–108 still says "a public host (the
relay) leaves it unset, so the RPCs report nothing configured and refuse the write" — with the
current `fromContext`, an unset store makes `onNotifyChannels` *reject* rather than report nothing.
No host does that today, so it is stale prose rather than a live defect; noted, not reported.

## Functions (low-level)

### `onPreferences()`
`contextPreferences().read().catch(() => ({}))`. A read failure (missing/corrupt registry) yields
`{}` so the dashboard renders its own defaults. `contextPreferences()` itself throws when unwired —
outside the `.catch`, since the throw happens before the promise exists — which is the intended
"wiring bug" behaviour. Correct.

### `savePreferences(preferences)`
Awaits the store's `save`, maps any throw to `{ok:false, error:'failed to save preferences'}`. The
error string is fixed and carries nothing from the exception — deliberate (nothing from a daemon
exception should reach a browser that may be a relay guest), and the daemon-side detail is lost
entirely (not even logged). Sanitization is the store's. Correct.

### `patchPreferences(patch)`
Returns `{ok:true, preferences: <what the store now holds>}`. The only subtlety is that the value
handed back is whatever `patch` resolves to, so the "adopt what you wrote against" contract is only
as true as the store's own return; `registryPreferencesStore().patch` returns the merged block.
Correct.

### `onProjectPresets(projectId)`
Unknown project → `[]`; a read failure → `[]`. `readProjectPresets(cwd)` is the file read, and the
`.catch` covers a missing file, a parse error, and permissions alike. Correct.

### `saveProjectPresets(projectId, presets)`
Unknown project → typed refusal; write failure → typed failure. `presets` is passed to
`writeProjectPresets` unvalidated — shape validation is that module's job, and the array arrives
from the browser as parsed JSON. Correct.

### `onEditors()`
`detectEditors().catch(() => [])` — detection spawns/probes on the daemon's machine; a failure
offers no editors rather than failing the request, per SPEC. Correct.

### `NotifyChannels` / `onNotifyChannels()`
`sources` comes from the store's `status()` (env first, then stored); `discordWebhook` is
`sources.webhook !== undefined`, which is true for both origins — right, since either origin
delivers. `editable: true` is a constant: with one host that can always store, the field carries no
information today, but it is not wrong. Only presence crosses the wire. Correct.

### `saveDiscordCredentials(patch)`
`contextDiscord().save(patch).catch(...)` — the store validates (`validateCredential`) and reports
its own typed refusal; the `.catch` covers an unexpected throw. Note the store's precedence rule:
when `DISCORD_WEBHOOK` is set in the environment, env wins, so a value stored from the dashboard is
accepted and then never used. The UI is expected not to offer the edit in that case (that is what
`sources.webhook === 'env'` is for), and the RPC does not re-check it. Reliance noted, not a defect
of this layer. Correct.

## Bugs found

1. **(fix belongs in `packages/framework/src/dashboard-rpc/test-context.ts` L25): every
   `provideTestContext()` call spawns the real `claude` CLI.** Noticed here because
   `preferences.test.ts` calls it three times. `provideTestContext` defaults `quota` to
   `defaultQuotaSource()` (`dashboard/quota.ts` L103–114), which constructs a `QuotaPoller` and
   calls `poller.start()` immediately; `start()` fires `poll()` on the spot, which runs
   `ClaudeCodeDriver.readQuota()` → `readClaudeQuota()` → `spawn('claude', ['-p','/usage', ...])`
   with a **deliberately non-unref'd** 20 s timeout (`driver/claude-code-quota.ts` L128–131). No
   test ever calls `quota.stop()`. So running the dashboard-rpc suite spawns one real `claude`
   child per `provideTestContext()` call across `preferences.test.ts`, `quota.test.ts`,
   `projects.test.ts`, `control.test.ts` and `agent-addressing.test.ts` — dozens of processes that
   hit the user's rate-limited upstream `/usage` endpoint (whose own doc warns the penalty window is
   "minutes long"), and each of which keeps a non-unref'd timer alive for up to 20 s after the tests
   finish. Severity: minor (test-suite side effect, not product behaviour, but it slows the suite,
   makes it depend on a CLI and a network, and degrades the developer's real quota panel).
   Confidence: high. Fix: give `provideTestContext` an inert quota default —
   `quota: { read: async () => ({ windows: [], unavailable: 'fetch-failed' }), boundaryFor: async () => undefined, stop: () => {} }` —
   and let the one test that wants a real source pass it explicitly.
