The two Discord setup dialogs (#958, credentials in #1095): bot token and notification webhook, each taking the credential in-product plus a preference toggle.

## TLDR

- `DiscordBotDialog` and `DiscordWebhookDialog` are thin wrappers over one shared `CredentialDialog` shell: explain, take the credential, toggle the preference (`discordBot` / `notifyDiscord`).
- #958 shipped these as explainers telling you to edit the daemon's environment and restart — the one onboarding step you could not finish in the product; they now save via `saveDiscordCredentials` with per-credential patches (`{botToken}` / `{webhook}`), where `null` removes.
- Credential states from `NotifyChannels`: unconfigured → steps + password field (validated client-side by `validateCredential` before the round trip); stored → "saved" card with Replace/Remove; `source === 'env'` → reported as set by `credentialEnvVar(...)`, not editable; `!editable` host → "does not store credentials".
- `DISCORD_BOT_DESCRIPTION` / `DISCORD_WEBHOOK_DESCRIPTION` are exported because each is shown twice on purpose: the Onboarding checklist row and inside the dialog (also reachable without the checklist).
- The toggle works credential-or-not; without one the copy says it starts working once the credential is set.

## Decisions

- The value goes to the daemon and is never read back — the dialog only learns that one is stored and where from — hence Replace/Remove instead of a pre-filled field.
- An env-set credential wins over a stored one daemon-side, so that case is reported as fixed rather than offering an edit the daemon would shadow.
- On close, any typed value/error/replacing state is wiped: reopening must not hand the next person at the keyboard a token sitting in a field.
- The save patch is written out (`credential === 'botToken' ? {botToken: next} : {webhook: next}`) rather than a computed key: `{[credential]: next}` widens to an index signature, and the patch's whole point is that an unmentioned credential is left alone.
