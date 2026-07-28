Build script that compiles `prompts/**/*.md` (#551) into `src/prompts.generated.ts` as exported string constants, so prompting is authored as markdown while code imports plain strings.

## TLDR

- Recursively finds every `.md` under `prompts/` (README.md excluded — docs, not a prompt), sorted for stable output; `presets/security_audit.md` → `export const PRESETS_SECURITY_AUDIT`.
- Runs before every `build` / `test` / `typecheck`; the generated file is git-ignored, so it cannot drift the way the hand-copied template did.

## Decisions

- Generation instead of runtime `node:fs` reads (the ai-autopilot pattern): the system prompt and presets are reachable from `src/client.ts`, which the dashboard imports in the *browser* (#520) — an fs read there breaks the bundle; a strings-only module crosses the boundary for free and keeps `files: ["dist"]`.
- Values are `JSON.stringify`-escaped, not template literals: prompts contain backticks and `${{ }}` fragments, and hand-rolled escaping silently corrupts prompts; unreadable output is fine, nobody reads the file.
- Exactly one trailing newline is stripped per file: files end with one to be well-formed on disk, the prompts they carry do not.
