# Bug analysis: packages/framework/dashboard/lib/queue-entry.ts

## Business logic (high-level)

Turns one `TODO_AGENTS.md` queue line into `{text, ticket?, url?}` (#1164): a *leading* markdown link's text is the title; a `tickets/` target names a ticket by bare filename (the `WorkspaceTicket.file` key); an absolute http(s) target is an outbound url; any other target keeps the title but points nowhere; a link mid-sentence or no link at all leaves the line as its own text. Matches the SPEC exactly, and mirrors the daemon's `queuedTicketFile` (src/dashboard/overview.ts L190-198) so both sides classify identically — verified: same leading-link anchor, same `tickets/` prefix, same bare-filename slice.

Inputs come from `item.text` of parsed queue items (AiQueue.tsx L204, TicketsPage.tsx L121), i.e. the entry text with the markdown bullet already stripped by the queue parser — so the `^\s*\[` anchor meets the link directly. Edge cases:

- Title containing `]` (e.g. `[a[b]](t)` still fine; `[a]b](t)` not): `[^\]]+` stops at the first `]`, the `](` juncture then fails to match → whole line kept as text. Graceful fallback, consistent with "a link further in is part of a sentence".
- Target with spaces or a markdown title (`(target "t")`) → no match → plain text. Accepted simplicity; `sendQueueTicket` writes plain `tickets/<file>` targets.
- `tickets/` target with subdirectories (`tickets/a/b.md`) → ticket `a/b.md`; tickets live flat so unreachable, and the slice-only-prefix behaviour matches `queuedTicketFile`.
- Empty entry → `{text: ''}`. Caller renders an empty row for an empty line — upstream parsing does not produce empty items.
- `https?://` test is anchored implicitly by `startsWith`-like `^`? No — `/^https?:\/\//.test(target)` is anchored with `^`. Correct.
- Trailing-note stripping: the regex consumes trailing whitespace after the link; everything after is simply ignored (the tooltip shows the raw line at the call sites). Correct.

## Functions (low-level)

- `LEADING_LINK` — `^\s*\[([^\]]+)\]\(([^)\s]+)\)\s*`: title = non-`]` run (non-empty), target = non-`)`/non-space run (non-empty). Anchored at start with leading whitespace tolerated. Correct for the writer's format.
- `queueEntryLabel(entry)` — no match → `{text: entry.trim()}` (trim keeps stray indentation out of the list); match → trimmed title, then three-way target classification with the `TICKET_PREFIX` branch first (a hypothetical `tickets/` URL cannot exist since the prefix check runs on the raw target and an http url does not start with `tickets/` — order is safe either way). Verdict: correct.

## Bugs found

None found.
