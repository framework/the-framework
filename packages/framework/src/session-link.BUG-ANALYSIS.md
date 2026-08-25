# Bug analysis: packages/framework/src/session-link.ts

## Business logic (high-level)

Turns a session-link value into the real URL for the wrapped CLI's session. Two shapes are supported and
the module's whole job is to keep them apart: a **template** carrying the `{sessionId}` placeholder,
which the framework fills once the driver reports an id, and a **literal** URL, which must pass through
untouched. Also holds `CLAUDE_CODE_SESSION_LINK`, the generic Claude Code entry point, which the SPEC is
explicit is *not* a per-agent deep link — a headless run is not Remote-Controlled, so there is nothing to
deep-link to (#214) and it is only ever surfaced as an "Open Claude Code" affordance.

Invariants: `hasSessionIdPlaceholder` and `resolveSessionLink` agree on one placeholder constant, so a
value that reports as a literal is exactly a value `resolveSessionLink` leaves unchanged. `resolveSessionLink`
replaces *every* occurrence (`split`/`join` rather than `String.replace` with a string pattern, which
would replace only the first) — the right choice for a template that repeats the id in both path and
query. There is no state, no I/O, no lifecycle; nothing can leak or race.

Two things deliberately not done, both correct for this system rather than oversights: the id is not
URL-encoded, and the resulting string is not validated as a URL. Session ids come from the driver's own
session-link report and are opaque tokens (`[A-Za-z0-9_-]`-shaped in practice); the framework's contract
is "the driver told us the URL shape, we fill in the id it told us", so encoding here would corrupt a
driver that already reports an encoded id. Nothing in the file interpolates the value into HTML or a
shell, so the injection surface belongs to the consumer, not here.

## Functions (low-level)

- `SESSION_ID_PLACEHOLDER` (`'{sessionId}'`) — the single spelling both functions key on. Correct.
- `hasSessionIdPlaceholder(template)` — `String.includes`; `''` ⇒ `false` (a literal, and resolving it
  is a no-op, so the two functions stay consistent for it). Correct.
- `resolveSessionLink(template, sessionId)` — `split(placeholder).join(sessionId)`. Replaces all
  occurrences; a literal is returned identical (single-element split); an empty `sessionId` collapses
  the placeholder to nothing rather than leaving a broken `{sessionId}` in the URL, which is the more
  honest of the two failure shapes and is not reachable anyway (callers resolve only once an id exists).
  No regex is involved, so a `$` or `$&` inside `sessionId` cannot be interpreted as a replacement
  pattern — the bug the `String.replace` spelling would have. Correct.
- `CLAUDE_CODE_SESSION_LINK` (`'https://claude.ai/code'`) — a constant; the SPEC's constraint (never
  presented as a live per-agent link) is a consumer obligation, nothing this file can violate. Correct.

## Bugs found

None found.
