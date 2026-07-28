The one Discord REST call the bot needs (#680): `postMessage` posts as the bot into a channel, optionally threaded as a reply.

## TLDR

- POSTs to `https://discord.com/api/v10/channels/<id>/messages` with `Authorization: Bot <token>`; resolves `false` on any failure — a reply that cannot be delivered must never take the daemon down.
- `clampContent` trims to Discord's hard 2000-character limit, appending "… (truncated)" so a cut answer never reads as complete.
- `replyToId` sets `message_reference` with `fail_if_not_exists: false`, threading the answer onto the asking message so a busy channel stays readable.

## Decisions

- Separate from the outbound webhook posts in the intervention/activity watchers (#627): a webhook speaks into one channel and cannot reply, so answering where asked needs the API with the bot token. `fetch` is a parameter, as in the watchers, so tests never touch the network.
