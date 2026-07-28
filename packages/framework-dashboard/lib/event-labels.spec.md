Maps session-log event kinds to plain-language badge labels (#1035): jargon kinds get a friendly word, every other kind just loses its hyphens.

## Facts

- Overrides: `driver` → "agent", `settled` → "waiting", `usage` → "cost", `session-update` → "resume"; fallback is `kind.replace(/-/g, ' ')` (`system-prompt` → "system prompt").
- Values stay lowercase because the badge is CSS-uppercased.
