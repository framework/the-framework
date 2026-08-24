# Bug analysis: packages/framework/dashboard/lib/queue-entry.test.ts

## Business logic (high-level)

Pins the five behaviours of `queueEntryLabel` (#1164): ticket link → title + bare filename; trailing agent note excluded from the title; external http link kept as `url`; other link targets (bare repo path) keep the title but point nowhere; a plain line — including one with a mid-sentence link — is returned verbatim. Each test asserts the full returned object (`toEqual`) or the load-bearing field, so a regression in classification, prefix slicing, or note stripping fails a test. The suite matches the source's documented contract one-to-one; nothing is asserted vacuously.

Coverage gaps (noted, not bugs): no case for leading-whitespace entries (`'  [t](tickets/x.md)'` — the regex tolerates it), for the empty string, or for a `https` (TLS) ticket-like URL — none of which the writer produces.

## Functions (low-level)

- Ticket-link test — asserts both `text` and the bare `ticket` filename (prefix sliced), the key `WorkspaceTicket.file` uses. Correct.
- Trailing-note test — em-dash note after the link; asserts only `text` (the `ticket` field is irrelevant to the claim). Correct.
- External-url test — full object equality including `url`. Correct.
- Points-nowhere test — `README.md` target yields `{text}` with neither `ticket` nor `url` (toEqual would catch an extra property with a defined value). Correct.
- Plain-entry test — verbatim passthrough for a bare line and for a mid-sentence link. Correct.

## Bugs found

None found.
