What the tests cover:

- **Precedence** - the environment's webhook wins over a saved one; the saved one is used when the environment sets none; nothing is resolved when neither exists; a blank environment variable does not shadow a saved webhook.
- **Presence-only status** - the status names where the webhook came from (`stored` or `env`) and contains nothing that can be turned back into the webhook; a credential that is set nowhere is simply absent from it.
- **Validation** - a Discord webhook URL and a self-hosted `http://localhost` proxy are both accepted; text that is not a URL is refused ("not a URL"); a non-http scheme is refused ("http or https"); a blank value, the "Remove" button, is legal.
- **The variable named to the user** - the webhook's environment variable is reported as `DISCORD_WEBHOOK`.
- **The store** - a saved webhook is reported as `stored` afterwards; the running daemon is told only after the value is on disk; a reload that throws does not fail the save and the webhook stays stored; a webhook the environment already sets is refused ("DISCORD_WEBHOOK is set on the daemon") and nothing is written; an invalid webhook is refused before anything is written; a saved webhook can be cleared, after which nothing is configured; a webhook set by the environment reads as configured with origin `env`, so the dashboard can say who owns it.
