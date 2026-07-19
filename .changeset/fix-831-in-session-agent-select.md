---
'@gemstack/framework-dashboard': patch
---

Drop the agent/model select from the in-session composer (#831). A session is bound to the agent it started with: the driver is created once at spawn, and a follow-up message carries only text, so switching the select from Claude to Codex mid-session changed nothing but the *next* session's default. Model and agent are now chosen at the launcher, the one place they take effect.

Also fixes the quieter half of the same bug on a finished session: the resume composer read the global agent pref and sent it alongside the captured session id, so a Claude session id could be handed to `codex --resume`. A continuation now resumes on the agent the run actually ran under.
