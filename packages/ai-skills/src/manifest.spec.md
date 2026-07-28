Parses a `SKILL.md` document (YAML frontmatter + markdown body) into a validated `SkillManifest` plus trimmed instructions, throwing `SkillManifestError` on any failure.

## TLDR

- `FRONTMATTER` regex requires a leading `---` fence (CRLF-tolerant); missing fence, invalid YAML, and Zod validation failures each throw `SkillManifestError` with a specific message and the optional `source` label (file path) attached.
- Schema: required `name` (charset `[a-zA-Z0-9_-]+`) and `description`; optional `license`, `appliesTo`, `trigger`, `skip`, `metadata`.
- Unknown frontmatter keys are allowed and dropped (forward-compat with richer Anthropic-style manifests); `metadata` is the escape hatch for author fields that must survive.
- Zod issues are joined into one message as `<path>: <message>` pairs (`(root)` when pathless).

## Facts

- The `name` charset restriction exists so compose-time tool namespacing (`<skill>__<tool>`) never has to mangle a name (test: "characters that would be silently mangled at compose time").
