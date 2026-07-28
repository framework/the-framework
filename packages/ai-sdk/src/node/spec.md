`@gemstack/ai-sdk/node` subpath: Node-only file-path loaders kept out of the runtime-agnostic main entry.

## TLDR

- `attachment.ts` — `documentFromPath` / `imageFromPath` (read file, extension→MIME sniff, base64).
- `transcription.ts` — `transcribeFromPath` (file → `Transcription.fromBytes`).
- `index.ts` — re-exports.

## Facts

- These use `node:fs`/`node:path`, which the main entry must not import (the isomorphic constraint enforced by `src/isomorphic-check.test.ts`) — hence the separate `./node` export in `package.json`.
