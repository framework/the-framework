# Bug analysis: packages/framework/src/loopback-host.ts

## Business logic (high-level)

Security-relevant leaf module (#1051): decides whether a host is loopback (drives whether a daemon bind gates behind the shared token, and whether an RPC request's `Host` header is a DNS-rebinding attempt), plus a `Host`-header hostname extractor that preserves bracketed IPv6. Checked against `loopback-host.SPEC.md`: loopback = `localhost`, IPv6 loopback, whole IPv4 `127/8` range; bind-all and routable are not; lookalike *names* (`127.evil.com`) never accepted; port dropped and brackets preserved when reading a declared host. All four clauses implemented.

The critical property for a guard like this is **fail-closed on ambiguity** — anything not certainly loopback must answer false (which means "gate behind the token" / "reject the Host"). Walked through the ambiguous inputs:

- `127.evil.com`, `127.0.0.1.evil.com` — rejected: the regex requires exactly four numeric octets anchored both ends. This is the very rebinding case the module exists for.
- Alternate loopback spellings a browser can reach (`0x7f000001`, `2130706433`, `127.1`, `::ffff:127.0.0.1`, `0:0:0:0:0:0:0:1`) — all rejected → gated. Fail-closed, so no vulnerability; at worst a token prompt for an exotic-but-genuine local address.
- Case (`LOCALHOST`) and trailing-dot (`localhost.`) forms — rejected → gated. Fail-closed.
- Empty string — rejected (tested).
- Leading-zero octets (`127.0.07.1`) — rejected by `[1-9]?\d` (cannot match `07`), which also dodges octal-interpretation ambiguity. Good.
- Regex octet ranges verified: `25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d` covers 0–255 exactly, no leading zeros; `{3}` requires precisely three dot-octets after `127`.

`hostnameFromHostHeader` edge cases: `[::1]:4200` → `[::1]` (the mangling case splitting on the first colon would hit); malformed `[::1` (no close bracket) returns the raw header, which then fails `isLoopbackHost` → fail-closed; a bare unbracketed IPv6 header like `::1` (invalid per RFC 7230 anyway) yields `''` → fail-closed; `host:port:junk` yields everything before the first colon, correct for valid headers. No case exists where a non-loopback origin can be *accepted*.

## Functions (low-level)

- **`LOOPBACK_V4`** — anchored 127/8 dotted-quad matcher; analysis above. Correct.
- **`isLoopbackHost(host)`** — exact-match set plus the regex; both bracketed and bare IPv6 loopback accepted because callers pass both bind addresses (`::1`) and extracted header hostnames (`[::1]`). Returns false for everything else. Verdict: correct, fail-closed.
- **`hostnameFromHostHeader(header)`** — bracket-aware port strip; analysis above. Verdict: correct.

## Bugs found

None found.
