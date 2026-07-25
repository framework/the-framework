---
'@gemstack/the-framework': patch
---

Stop a stale dashboard tab from reverting your theme, and every other preference with it. A settings write now sends only the keys it changed, the daemon merges them over what is stored and hands back the result, and a tab re-reads both preference tiers when it comes back to the foreground.
