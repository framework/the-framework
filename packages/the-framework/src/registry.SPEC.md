The user's one home file: the projects The Framework is installed into, the dashboard preferences (global and per-project), the daemon's access token, and third-party credentials.

## TLDR

- A single JSON file per machine in the user's home, owned by the daemon, so the dashboard never needs browser storage.
- Reads are forgiving — a missing, malformed, or old-format file yields an empty registry — and every value is sanitized on the way in (clamped numbers, known-set strings, capped lists), so a hand-edited or hostile file can neither break anything nor smuggle junk into runs.
- Preferences resolve in tiers: a project's overrides win over the globals only for the keys it actually set, and person-about settings (theme, editor, notifications, saved prompts) stay global.
- Patch writes touch only the keys the caller changed, so a stale dashboard tab cannot silently revert someone else's setting.
- Writes are atomic, serialized, and owner-only readable: the file carries the daemon token and credentials, and a half-written or world-readable registry would lose or leak everything.
- The token and secrets live outside the preferences so they can never reach the browser; clients are only ever told a credential is present.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
