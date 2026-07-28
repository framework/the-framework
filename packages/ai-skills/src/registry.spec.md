`SkillRegistry` — discovers `SKILL.md` bundles by their cheap frontmatter and fully loads them on demand with caching (the progressive-disclosure half of the skill model).

## TLDR

- `discover(root, opts)` — scans the immediate subdirectories of `root` for a `SKILL.md`, parses frontmatter only, indexes entries (`{manifest, dir}`) by manifest `name`; returns the entries found in this scan. Missing/unreadable root → empty result, no throw.
- A malformed or unreadable `SKILL.md` is skipped, never fatal; the optional `opts.onError(error, skillPath)` hook observes what was skipped.
- `load(name, opts)` — `loadSkill()` on the indexed dir (parses body, imports tools module, gathers resources); cached by name — a second `load()` returns the same instance unless `force`. Undiscovered name → error listing available names (or "call discover() first").
- `list()` (insertion order), `get(name)`, `loadAll(names)` (requested order).

## Problems

- Indexing hundreds of skills must stay cheap and safe: discovery reads only frontmatter and never executes skill code; code runs only at `load()` (which imports the tools module) — the trust boundary.
- One bad bundle in a tree must not break discovery of the rest — hence skip-and-continue with the observer hook.

## Decisions

- Duplicate names across scans: last wins, mirroring how registered/allowlisted skill sources layer.
- The undiscovered-name error enumerates available skill names for debuggability.
