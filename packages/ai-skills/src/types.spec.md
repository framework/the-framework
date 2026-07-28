Core type definitions of the skills domain: `SkillManifest`, `ParsedSkill`, `SkillResource`, `LoadedSkill`, and `SkillSurface`.

## Facts

- `SkillManifest` mirrors the `boost/skills` convention in `@gemstack/ai-sdk` and the Anthropic Agent Skills shape, so skills are interoperable between the two.
- `trigger` / `skip` are natural-language when-to-load cues for progressive disclosure; `appliesTo` is unenforced documentation; `metadata` passes through untouched.
- `LoadedSkill.middleware` is optional and rare; `LoadedSkill.dir` is set only when loaded from disk.
- `SkillSurface` exists for the explicit trust boundary — inspect a skill's instructions size, tool names, and resources before composing it.
