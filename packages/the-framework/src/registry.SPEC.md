The user's one home file: the projects The Framework is installed into, the user's dashboard preferences, the daemon's access token, and third-party credentials.

## TLDR

- A single JSON file per machine in the user's home, owned by the daemon, so the dashboard never needs browser storage.
- Reads are forgiving — a missing, malformed, or old-shaped file yields an empty registry — and every value is sanitized on the way in (clamped numbers, known-set strings, capped lists), so a hand-edited or hostile file can neither break anything nor smuggle junk into an agent.
- One shape, and one spelling per setting. A file in an older shape reads as no projects and no preferences at all, and a setting under an older name is simply not there — nothing is translated on the way in, so a file left behind by a rename is brought up to date by hand.
- A setting whose states are strictly nested is stored as the one ordinal it is, not as a flag per stage: how far an agent publishes itself is a single rung, so the file cannot hold a combination no agent could honour.
- One tier of preferences lives here, and it is the user's. Repo-shaped settings belong in the repo's committed file, so a per-project block in a home file was a second answer to the same question that only one machine could see.
- Patch writes touch only the keys the caller changed, so a stale dashboard tab cannot silently revert someone else's setting.
- Writes are atomic, serialized, and owner-only readable: the file carries the daemon token and credentials, and a half-written or world-readable registry would lose or leak everything.
- The token and secrets live outside the preferences so they can never reach the browser; clients are only ever told a credential is present.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
