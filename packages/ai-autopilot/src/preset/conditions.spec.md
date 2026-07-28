Modes as conditional `.md` files (#244): pure override-resolution helpers that let a preset directory hold a base file plus per-mode variants sharing a filename stem.

## TLDR

- `stemOf(filename)` — the name up to the first `.` (after stripping `.md`) — a file's identity for override grouping (`major-change.autopilot.md` groups with `major-change.md`).
- `readConditions(meta)` — normalizes `metadata.conditions` (string or list) to a trimmed string list; empty for a base file.
- `selectWinners(entries, activeModes)` — per stem, keep the single most-specific eligible entry: eligible = *every* condition is an active mode; most matched conditions wins; the condition-less base is the fallback; input order breaks ties deterministically. Pure, no I/O.

## Facts

- A variant with no eligible sibling (e.g. only a conditioned file exists and its mode is inactive) yields nothing for that stem.
- This is the simple frontmatter fan-out; real prompt composition from parameters is the follow-up (#245) if variant files get too duplicative.
