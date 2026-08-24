# Bug analysis: packages/framework/dashboard/lib/session-link.test.ts

## Business logic (high-level)

Covers `describeSessionLink`'s decision table: null/empty/id-only inputs → null; the generic `claude.ai/code` entry with an id → null (the substring check fails, which is the point — the product page does not encode the session); a literal URL not containing the id → null; link-without-id-yet → null; and the one positive case, a deep link containing the id, asserted with full object equality including the label text. Every branch of the source's guard chain is exercised; no vacuous assertions.

Gap (noted, not a bug): no case pins the empty-string-id guard (`sessionId: ''` with any link must stay null — `includes('')` would otherwise bless it); the `!id` guard covers it but is untested.

## Functions (low-level)

- "returns null when there is no link" — three absent-input shapes. Correct.
- "generic Claude Code entry" — the exact real-world default URL. Correct.
- "literal link that does not encode the id" — non-matching host. Correct.
- "null before the id is reported" — link configured, id absent. Correct.
- "a real deep link that encodes the id" — `toEqual({href, label: 'Open session (532ccc4b) ↗'})`. Correct.

## Bugs found

None found.
