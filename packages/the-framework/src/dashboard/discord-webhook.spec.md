The single Discord *webhook* transport (#627): one POST of one message, resolving whether Discord accepted it — never throwing out of a daemon watcher (non-ok and network errors both resolve `false`).

## Decisions

- Deliberately not in `discord/rest.ts` (that module is the bot-token API; a webhook needs no token and reaches one fixed channel), but it reuses that module's `clampContent`: Discord rejects messages over 2000 chars outright, so an unclamped batch would silently post nothing (#940).
- Extracted because the two notification posters (activity, interventions) each carried their own copy of this fetch; only their line formatters stay beside the types they switch on.
