Translates the typed OpenAI-shaped `FileSearchFilter` into Gemini's `metadataFilter` string syntax for the native fileSearch tool (#B8.5).

## Facts

- Comparison ops map to `= != > >= < <=`; `and`/`or` render each sub-filter parenthesized and joined with ` AND `/` OR `; empty `and`/`or` throws (would be an invalid expression).
- String values are double-quoted with `"` and `\` escaped; numbers and booleans render bare.
- Exported for unit testing (`google-vector-stores.test.ts`).
