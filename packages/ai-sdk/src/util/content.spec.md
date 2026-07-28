`contentToString()` — flattens string-or-`ContentPart[]` message content to plain text, keeping text parts in order and dropping image/document parts.

## Facts

- The `separator` parameter is explicit because the two call sites intentionally differ (#573): providers join with `''` (default) to reconstruct the wire message as authored; memory extraction joins with `'\n'` so text doesn't jam together (`Helloworld`) where a dropped non-text part sat between parts.
