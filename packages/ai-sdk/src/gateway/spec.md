The gateway template (`./gateway` subpath): a Template-Method base class for normalizing an arbitrary AI gateway's auth and wire format behind the standard provider contract.

## Facts

- The base owns fetch, JSON/SSE handling, abort wiring, and error mapping; four abstract hooks cover the gateway's shape (headers, request body, response parse, stream-event parse).
- Explicit guidance: **don't subclass for an OpenAI- or Anthropic-compatible gateway** — register the existing driver with a base-URL override instead.
- Ships its own dependency-free SSE framer (multi-line data, CRLF, mid-frame chunk boundaries, clean abort) because every built-in provider streams through a vendor SDK — there was no shared framer to reuse.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
