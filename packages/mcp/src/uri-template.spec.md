Matches a URI against a `{param}` template pattern (e.g. `weather://location/{city}`), returning percent-decoded params or `null` — with traversal-safe guards.

## TLDR

- `{word}` placeholders compile to `([^/]+)` captures; the literal text between them is regex-escaped before entering the `RegExp`.
- Captured values are `decodeURIComponent`ed; a decoded value containing `/` is a non-match (the separator guard must hold post-decode or `%2F` smuggles traversal past `[^/]+`); a malformed escape (`%zz`) is a non-match, not a throw.

## Problems

- All fixed under #968: decoding after match acceptance let `..%2F..%2F..` through as a param; an unescaped `.` in a template widened matches and a literal `(` shifted capture indexes off their param names; unguarded `decodeURIComponent` threw `URIError` out of the caller's `resources/read` template loop where a non-match should fall through.

## Facts

- Used by both the SDK runtime (`resources/read` template matching) and the inspector's HTTP API — keep them on this one implementation; duplicating the matcher caused subtle drift in earlier revisions.
