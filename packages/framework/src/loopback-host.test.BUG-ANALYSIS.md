# Bug analysis: packages/framework/src/loopback-host.test.ts

## Business logic (high-level)

Four synchronous tests pinning the guard's contract from both directions: the accept set (`localhost`, `127.0.0.1`, `::1`, `[::1]`), the full `127/8` range including its extremes (`127.0.0.2`, `127.1.2.3`, `127.255.255.255` — the #1051 regression where a copy compared against `127.0.0.1` alone), the reject set including the actual attack shapes (`127.evil.com`, `127.0.0.1.evil.com` — prefix *and* embedded-address variants — plus bind-all `0.0.0.0`/`::`, a routable `10.0.0.5`, and `''`), and the header parser's four shapes (port strip, portless passthrough, bracketed IPv6 with and without port — with the first-colon-mangling case called out).

Each loop passes `host` as the assertion message, so a failure names the offending input — good diagnosability. All assertions are exact boolean/string equality; nothing can pass vacuously. The security-critical direction (no non-loopback input accepted) is tested with the two realistic rebinding payloads; exotic accept-side bypass spellings (`127.1`, hex/decimal integers, `::ffff:127.0.0.1`) are untested but are *rejected* by the implementation, i.e. fail-closed, so their absence cannot hide a vulnerability — only a spurious token gate. Untested fail-closed edges also include uppercase `LOCALHOST` and the malformed `[::1` header; acceptable scope.

## Functions (low-level)

Only test bodies:

- **accept-set test** — four canonical loopback forms. Correct.
- **/8-range test (#1051)** — three range representatives including the broadcast-end extreme. Correct.
- **reject-set test** — rebinding names, bind-alls, routable, empty. Correct; this is the test that makes the `startsWith('127.')` shortcut impossible to reintroduce.
- **header test** — port stripping and bracket preservation. Correct.

## Bugs found

None found.
