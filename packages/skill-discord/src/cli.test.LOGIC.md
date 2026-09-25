What the tests cover, against a webhook stood up on loopback that keeps what it was sent and answers a chosen HTTP status, with each machine a fresh `XDG_CONFIG_HOME`:

- **Setup, then send** - `setup <webhook>` exits 0, writes the webhook to the saved webhook's file, readable and writable by its owner only (mode 600); `send` answers `{"ok":true,"source":"saved"}` and the webhook receives exactly the message with mentions turned off; `status` answers `{"ok":true,"webhook":true,"source":"saved"}`.
- **The environment wins** - with a saved webhook and `DISCORD_WEBHOOK` set to another, `send` goes to the environment's only, answered with the source `env`; `setup` while `DISCORD_WEBHOOK` is set answers `shadowedBy: "DISCORD_WEBHOOK"`.
- **No webhook** - `send` on a machine with none exits 1 with the reason `no-webhook` and stderr naming `discord setup`.
- **A webhook that refuses** - a 404 answer makes `send` exit 1 with the reason `not-posted` and stderr naming the 404.
- **A failure never prints the webhook** - a webhook with a user and password, one without a scheme, and one on a port nothing answers each make `send` exit 1 with the reason `not-posted`, and neither the JSON nor stderr contains the URL's secret part.
- **A long message** - a message 50 characters over the limit reaches the webhook at exactly 2,000 characters, ending with `(cut)`; a message whose cut falls inside an emoji leaves no half of the emoji before the notice.
- **Refusals and usage errors** - `setup` with a value that is not a URL, or an `ftp` URL, exits 1; `setup --clear` exits 0 and `status` then answers `{"ok":true,"webhook":false}`; `send` with no message and an unknown command exit 2; `send` with only spaces answers the reason `empty`.
