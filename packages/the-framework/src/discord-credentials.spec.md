The browser-safe rules for the daemon's two Discord credentials (#1095) — resolution precedence, presence-only status, and validation — holding no credential values and no node imports, so the dashboard shares the exact validation the daemon enforces.

## TLDR

- Credentials: `botToken` (env `DISCORD_BOT_TOKEN` / registry `discordBotToken`; the #680 chatbot — a bot can read replies, the webhook cannot) and `webhook` (env `DISCORD_WEBHOOK` / registry `discordWebhook`; where #627 notifications post).
- `resolveDiscordCredentials(env, secrets)`: env wins, stored is the fallback. `discordCredentialStatus`: the same resolution reported as presence + origin (`env` | `stored`), never values.
- `validateCredential`: token must not start with `Bot ` (Discord's own Authorization-header shape, a common paste — checked before the whitespace rule so the message is specific), no whitespace, ≥20 chars; webhook must parse as an http(s) URL. Empty/clearing is always legal.
- `ENV_KEYS`/`SECRET_KEYS`/`CREDENTIALS` tie the tables together so loops cover both credentials by construction.

## Decisions

- Env wins and the dashboard *says so* rather than offering an edit that would not take effect: an env var is how a deployment (container, systemd unit, shared box) configures the daemon, and a value typed into a browser must not quietly override the machine.
- Status is presence-only — a stored credential is not a credential you can read back; the #948 `onNotifyChannels` contract kept on purpose.
- Validation is deliberately shallow: a webhook is checked for being http(s), not for being on discord.com (people front webhooks with proxies), and whether a credential authenticates is Discord's answer to give — the daemon logs it.
- Reading/writing lives in `discord-credentials-store.ts` on purpose, keeping the home-file edge out of the browser bundle; the `DiscordCredentialsStore` interface rides the Telefunc context, and a public host leaves it unset so the RPCs degrade like the preferences store.
