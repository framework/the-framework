Bookkeeping for Google's prompt caching, which unlike other vendors' requires explicitly creating a cache resource on Google's side and referencing it from later requests.

## TLDR

- Maps a fingerprint of the cached regions — instructions, tools, and/or leading messages, always tied to the model since Google binds each cache to one — onto the Google resource holding them, creating it on first use.
- Prompts too small for Google to cache run uncached, and that outcome is remembered briefly so busy loops don't hammer Google; any other creation failure falls back to uncached for that one request without poisoning the map.
- Concurrent requests for the same prefix share a single creation instead of racing.
- An entry can be forgotten, so when Google reports a cache as expired the chat adapter can recreate it and retry.
- The map survives restarts when the app supplies a cache store; otherwise it lives in process memory with a one-time warning.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
