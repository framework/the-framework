The eval framework (`./eval` subpath, dev/test-time): define suites of input cases plus assertions and run them against **the very same Agent classes the app uses**.

## TLDR

- Six built-in metrics — exact match, regex, LLM judge, JSON shape (Zod), semantic match (embeddings + cosine), token cost — plus composition; any `(response, ctx) => result` function is a valid metric.
- Reporters: console, stable machine-readable JSON, and a self-contained escaped HTML report; results also emit observer events (including skips, so coverage gaps surface).
- Fixtures record real runs in the fake driver's step format for zero-API replay; the format is versioned so a bump forces re-recording rather than mis-replay.

## Facts

- Judge and embedding calls made *by an assertion* are folded back into the case's token total via a symbol-keyed side channel on the response — eval cost accounting includes the judging.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
